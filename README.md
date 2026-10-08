# ScamShield — Think Before You Trust

> An AI-powered scam and phishing defense application built with **Google Gemma 4 (`gemma-4-26b-a4b-it`)** and Flask.

---

## 🛡️ Project Overview & Problem Statement

Digital deception is evolving rapidly. Every day, individuals receive unsolicited text messages, fake bank alerts, delivery notifications, and phishing emails engineered with psychological urgency to induce panic and force hasty decisions.

For everyday users and non-technical individuals, distinguishing a sophisticated spoof from a genuine notice can be daunting. **ScamShield** addresses this challenge by providing an accessible, AI-assisted scam assessment platform. Users can paste suspicious messages or upload screenshots directly to receive:
1. A calibrated **threat risk rating** (`HIGH`, `MEDIUM`, or `LOW`).
2. An **instant plain-English explanation** demystifying the deception.
3. Explicit **observed red flags** (e.g., artificial urgency, spoofed headers, unverified domains).
4. Concrete, reassuring **safe protective actions** to prevent compromise.

---

## 🚀 Live Demo & Screenshots

- **Live Application URL:** `[Live Demo URL Placeholder]`
- **Video Demonstration:** `[Video Demo URL Placeholder]`

### Interface Preview
`[Screenshot Placeholder: Midnight Sentinel Analysis Interface]`

`[Screenshot Placeholder: Risk Assessment Breakdown]`

---

## ✨ Features

- **Dual-Input Modality:** Supports raw message text, screenshots, or both analyzed together.
- **Visual OCR & Threat Inspection:** Utilizes Gemma 4's multimodal capabilities to inspect sender identity, brand spoofing, urgency cues, and obscured URLs in screenshots.
- **In-Memory Image Processing:** Uploaded images are processed strictly in-memory and converted to Base64—no user images or personal data are stored permanently on disk.
- **Strict JSON Schema Enforcement:** Robust server-side extraction ensures valid, predictable structured output even when AI models output formatting tags.
- **XSS-Safe DOM Rendering:** All model outputs are dynamically injected using standard DOM APIs (`document.createElement` and `textContent`) to prevent script injection.
- **Midnight Sentinel Design System:** Custom-crafted dark cybersecurity UI with zero external font/CDN dependencies, responsive layouts, and `prefers-reduced-motion` compliance.

---

## 🛠️ Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **AI Model** | **Google Gemma 4** (`gemma-4-26b-a4b-it`) | Official open model for instruction and visual reasoning |
| **AI SDK** | `google-genai` (v2.29.0) | Official Google GenAI SDK with Interactions API (`client.interactions.create`) |
| **Backend** | Python 3.14 + Flask 3.1 | Lightweight WSGI backend providing multipart API endpoints |
| **Environment** | `python-dotenv` (v1.2.4) | Secure environment variable handling |
| **Frontend** | Semantic HTML5 + Custom CSS + Vanilla JS | Single-page architecture without external build tools or CDNs |

---

## 🏗️ Architecture & Request Flow

```
[User Browser]
       │
       │ (1) User pastes text or drops screenshot
       ▼
[Flask Backend (`POST /api/analyze`)]
       │
       │ (2) Validates file type, size (<16MB), and presence
       │ (3) Converts image in-memory to Base64 (zero disk storage)
       ▼
[Google GenAI Interactions API]
       │
       │ (4) Invokes `gemma-4-26b-a4b-it` with structured system prompt
       ▼
[Gemma 4 Threat Reasoning Engine]
       │
       │ (5) Analyzes sender headers, visual cues, urgency, and URLs
       │ (6) Returns structured JSON assessment
       ▼
[Flask Backend Validation Layer]
       │
       │ (7) Strips markdown fences, parses JSON, validates schema
       ▼
[Browser Client]
       │
       │ (8) Safely renders risk badge, red flags, and safe checklist
```

---

## 💻 Local Setup Instructions (Windows)

### Prerequisites
- Python 3.11+ (Python 3.14 confirmed working)
- Git (optional, for version control)
- Google AI Studio API key

### 1. Clone or Open the Repository
```powershell
cd C:\Users\singh\Downloads\Scamshield
```

### 2. Set Up the Virtual Environment
Create and activate an isolated virtual environment:
```powershell
python -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
Install only the runtime dependencies:
```powershell
pip install -r requirements.txt
```

### 4. Configure Your API Key
Copy the example environment file and insert your API key:
```powershell
Copy-Item .env.example .env
```
Open `.env` in your text editor and add your Google AI Studio API key:
```env
GEMINI_API_KEY=your_actual_api_key_here
```
> ⚠️ **Important:** Never commit the `.env` file to Git. It is automatically ignored by `.gitignore`.

### 5. Run the Application
Start the Flask server:
```powershell
python app.py
```
Open your browser and navigate to:
```
http://127.0.0.1:5000/
```

---

## 📡 API Endpoint Documentation

### 1. Health Check
- **URL:** `/api/health`
- **Method:** `GET`
- **Description:** Returns the operational status and configured model.
- **Response (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "service": "ScamShield Backend",
    "model": "gemma-4-26b-a4b-it"
  }
  ```

---

### 2. Scam Analysis
- **URL:** `/api/analyze`
- **Method:** `POST`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `text` *(optional string)*: The suspicious message, URL, or communication body.
  - `image` *(optional file)*: A screenshot in PNG, JPEG, WEBP, GIF, or BMP format (max 16 MB).
  *(At least one field must be provided).*

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "analysis": {
    "risk_level": "HIGH",
    "red_flags": [
      "Artificial urgency ('will be blocked today', 'immediately')",
      "Threat of account suspension without formal notice",
      "Unsolicited request to click a verification link",
      "Sender identified as an unknown entity"
    ],
    "reasons": [
      "Legitimate financial institutions rarely mandate instant online verification through SMS links.",
      "High-pressure language is deliberately crafted to bypass rational skepticism."
    ],
    "safe_actions": [
      "Do NOT click on the link in the message.",
      "Do NOT reply to or call the sender.",
      "Verify directly by dialing the phone number on the back of your physical card.",
      "Report and delete the suspicious message."
    ],
    "beginner_explanation": "This message is a phishing attempt trying to frighten you into clicking an unverified link to steal login credentials."
  }
}
```

#### Error Response (`400 / 413 / 500 / 502`):
```json
{
  "success": false,
  "error": "Please provide suspicious text or upload an image to analyze."
}
```

---

## 🧪 Testing Instructions

### Standalone Gemma 4 Verification
To test raw API connectivity with `gemma-4-26b-a4b-it` without running the web server:
```powershell
python test_gemma.py
```

### Automated Endpoint Verification
With the server running (`python app.py`), you can test the API using Python:
```powershell
python -c "import requests; print(requests.get('http://127.0.0.1:5000/api/health').json())"
```

---

## ☁️ Deployment Configuration (Vercel)

ScamShield is structured for zero-overhead deployment on Vercel:
- **`vercel.json`** routes all incoming web requests into `app.py`:
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/app.py"
      }
    ]
  }
  ```
- **Static Assets:** Flask natively serves `/static/css/styles.css` and `/static/js/app.js` without requiring path modifications.
- **Environment Variables:** Set `GEMINI_API_KEY` in the Vercel Project Settings under **Settings > Environment Variables**.

---

## ⚠️ Limitations & Responsible-Use Disclaimer

1. **Advisory Tool:** ScamShield is designed as an educational and risk-assessment aid. It does not provide legal guarantees, official banking verification, or conclusive evidence of criminal activity.
2. **Probabilistic Output:** Generative AI models evaluate patterns and likelihoods based on provided context; subtle attacks may evade detection and benign notices may exhibit suspicious urgency.
3. **Primary Rule:** Always independently verify sensitive communications through verified, authoritative channels (e.g., official bank apps, known support telephone numbers).
