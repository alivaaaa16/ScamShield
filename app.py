import os
import json
import base64
import logging
from typing import Dict, Any, Tuple
from flask import Flask, request, jsonify, render_template
from dotenv import load_dotenv
from google import genai
from google.genai import errors

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScamShield")

# Load environment variables
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemma-4-26b-a4b-it"

# Initialize Flask application
app = Flask(__name__)

# Enforce reasonable file upload limit: 16 MB
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

# Allowed image MIME types and file extensions
ALLOWED_MIME_TYPES = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
    "image/bmp": "image/bmp",
}

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

SYSTEM_PROMPT = """You are ScamShield AI, an expert cybersecurity assistant specializing in scam and phishing detection.
Your role is to analyze suspicious messages and screenshots to assess scam RISK for everyday users.

Assessment Guidelines:
1. Assess scam RISK—do not make absolute claims that something is definitively or legally a scam, but highlight risk indicators and likelihood.
2. Mention uncertainty where appropriate. Do not invent facts, senders, or details that are not visible or provided.
3. For screenshots, inspect visible sender information, phone numbers, email headers, URLs/domains, branding, payment instructions, QR codes, OTP/PIN/password requests, artificial urgency, threats, impersonation, and stylistic or visual inconsistencies.
4. Treat suspicious or mismatched links and unverified contact details as red flags, but do not assert a URL is malicious unless evidence supports it.
5. Provide practical, cautious safe actions. NEVER recommend clicking suspicious links, sharing OTPs/passwords/PINs, sending money, or calling an unverified number.
6. Make explanations clear, reassuring, and beginner-friendly.

You MUST respond ONLY with a raw JSON object (do not include markdown formatting or commentary outside the JSON object) matching this EXACT schema:
{
  "risk_level": "LOW",
  "red_flags": [
    "A specific observed red flag"
  ],
  "reasons": [
    "Explanation of why this communication is suspicious or benign"
  ],
  "safe_actions": [
    "A practical, safe protective step the user should take"
  ],
  "beginner_explanation": "A simple 1-2 sentence explanation of what is happening in plain English."
}

Rules for JSON values:
- "risk_level" MUST be exactly one of: "LOW", "MEDIUM", "HIGH".
- "red_flags", "reasons", and "safe_actions" MUST be arrays of strings.
- "beginner_explanation" MUST be a string.
"""

def get_genai_client() -> genai.Client:
    """Retrieve or initialize the GenAI client using the loaded API key."""
    if not API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in the environment.")
    return genai.Client(api_key=API_KEY)


def extract_and_validate_json(raw_text: str) -> Dict[str, Any]:
    """
    Robustly extract and validate JSON from model output.
    Handles potential markdown code fences or surrounding text.
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Model returned an empty response.")

    text = raw_text.strip()

    # Strip markdown code block wrappers if present (e.g. ```json ... ```)
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Extract JSON object boundaries
    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]

    try:
        data = json.loads(text)
    except Exception as exc:
        logger.error("Failed to parse JSON from model output: %s", exc)
        raise ValueError(f"Model output could not be parsed as JSON: {exc}")

    if not isinstance(data, dict):
        raise ValueError("Model output root is not a valid JSON object.")

    # Validate required keys
    required_keys = {"risk_level", "red_flags", "reasons", "safe_actions", "beginner_explanation"}
    missing = required_keys - set(data.keys())
    if missing:
        raise ValueError(f"Model output is missing required fields: {', '.join(sorted(missing))}")

    # Validate risk_level
    risk_level = str(data.get("risk_level", "")).strip().upper()
    if risk_level not in {"LOW", "MEDIUM", "HIGH"}:
        raise ValueError(f"Invalid risk_level '{risk_level}'. Must be LOW, MEDIUM, or HIGH.")
    data["risk_level"] = risk_level

    # Validate arrays of strings
    for list_key in ["red_flags", "reasons", "safe_actions"]:
        val = data.get(list_key)
        if not isinstance(val, list):
            raise ValueError(f"Field '{list_key}' must be an array of strings.")
        data[list_key] = [str(item).strip() for item in val if str(item).strip()]

    # Validate beginner_explanation
    beginner_exp = data.get("beginner_explanation")
    if not isinstance(beginner_exp, str) or not beginner_exp.strip():
        raise ValueError("Field 'beginner_explanation' must be a non-empty string.")
    data["beginner_explanation"] = beginner_exp.strip()

    return data


def resolve_image_mime_type(filename: str, content_type: str) -> str:
    """Resolve and validate the MIME type of an uploaded image."""
    if content_type and content_type.lower() in ALLOWED_MIME_TYPES:
        return ALLOWED_MIME_TYPES[content_type.lower()]

    ext = os.path.splitext(filename)[1].lower() if filename else ""
    ext_mapping = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
    }
    if ext in ext_mapping:
        return ext_mapping[ext]

    return ""


@app.errorhandler(413)
def handle_file_too_large(error):
    return jsonify({"success": False, "error": "File size exceeds the 16MB upload limit."}), 413


@app.route("/", methods=["GET"])
def index():
    """Render the ScamShield web interface."""
    return render_template("index.html")


@app.route("/api/health", methods=["GET"])
def health_check():
    """Simple health check endpoint confirming the Flask backend is operational."""
    return jsonify({
        "status": "healthy",
        "service": "ScamShield Backend",
        "model": MODEL_NAME
    }), 200


@app.route("/api/analyze", methods=["POST"])
def analyze_scam():
    """
    Analyze suspicious text, image, or both for scam risk using Gemma 4.
    Accepts multipart/form-data with optional 'text' and 'image' fields.
    """
    text_content = request.form.get("text", "").strip()
    image_file = request.files.get("image")

    has_text = bool(text_content)
    has_image = bool(image_file and image_file.filename)

    # Validation: at least one input must be provided
    if not has_text and not has_image:
        # Check if text was passed but was empty/whitespace
        if "text" in request.form and not text_content:
            return jsonify({"success": False, "error": "Provided text cannot be empty."}), 400
        return jsonify({
            "success": False,
            "error": "Please provide suspicious text or upload an image to analyze."
        }), 400

    # Build input blocks for Gemma 4 Interactions API
    input_blocks = []

    if has_image:
        filename = image_file.filename
        content_type = image_file.content_type or ""
        mime_type = resolve_image_mime_type(filename, content_type)

        if not mime_type:
            return jsonify({
                "success": False,
                "error": f"Unsupported image format. Allowed formats: PNG, JPEG, WEBP, GIF, BMP."
            }), 400

        try:
            # Read image bytes in memory without saving to disk
            image_bytes = image_file.read()
            if not image_bytes:
                return jsonify({"success": False, "error": "Uploaded image file is empty."}), 400

            b64_data = base64.b64encode(image_bytes).decode("ascii")
            input_blocks.append({
                "type": "image",
                "data": b64_data,
                "mime_type": mime_type
            })
        except Exception as exc:
            logger.error("Failed to process uploaded image: %s", exc)
            return jsonify({"success": False, "error": "Failed to process uploaded image."}), 400

    if has_text:
        text_prompt = f"Suspicious communication content:\n\"\"\"\n{text_content}\n\"\"\""
        input_blocks.append({
            "type": "text",
            "text": text_prompt
        })
    elif has_image:
        input_blocks.append({
            "type": "text",
            "text": "Please analyze this uploaded screenshot for scam and phishing risk indicators."
        })

    # Prepare interaction payload
    # When text-only, a single string can also be passed, or a list of content blocks
    try:
        client = get_genai_client()
        response = client.interactions.create(
            model=MODEL_NAME,
            system_instruction=SYSTEM_PROMPT,
            input=input_blocks
        )

        output_text = getattr(response, "output_text", None)
        if not output_text and hasattr(response, "text"):
            output_text = response.text

        analysis_result = extract_and_validate_json(output_text)

        return jsonify({
            "success": True,
            "analysis": analysis_result
        }), 200

    except ValueError as ve:
        logger.warning("Validation error on model output: %s", ve)
        return jsonify({
            "success": False,
            "error": f"Analysis failed validation: {str(ve)}"
        }), 502

    except errors.APIError as api_err:
        logger.error("Gemma API error: %s", api_err)
        return jsonify({
            "success": False,
            "error": "Error communicating with AI analysis service. Please try again."
        }), 500

    except Exception as exc:
        logger.error("Unexpected error during analysis: %s", exc)
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred during analysis."
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
