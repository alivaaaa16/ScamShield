/**
 * ScamShield — Frontend Client Controller
 * Connects to Flask backend (/api/analyze) and safely renders Gemma 4 threat assessments.
 */

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // ---------------------------------------------------------------------------
  // 1. DOM Elements
  // ---------------------------------------------------------------------------
  const scamForm = document.getElementById("scamForm");
  const textInput = document.getElementById("textInput");
  const imageInput = document.getElementById("imageInput");
  const dropZone = document.getElementById("dropZone");
  const dropzoneEmpty = document.getElementById("dropzoneEmpty");
  const dropzonePreview = document.getElementById("dropzonePreview");
  const previewImage = document.getElementById("previewImage");
  const previewName = document.getElementById("previewName");
  const previewSize = document.getElementById("previewSize");
  const removeImageBtn = document.getElementById("removeImageBtn");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const btnText = document.getElementById("btnText");
  const btnSpinner = document.getElementById("btnSpinner");
  const resetBtn = document.getElementById("resetBtn");
  const formError = document.getElementById("formError");
  const formErrorMessage = document.getElementById("formErrorMessage");
  const sampleButtons = document.querySelectorAll(".btn-sample");

  // Loading & Results elements
  const loadingIndicator = document.getElementById("loadingIndicator");
  const loadingStatusText = document.getElementById("loadingStatusText");
  const emptyResultsState = document.getElementById("emptyResultsState");
  const resultsCard = document.getElementById("resultsCard");
  const riskHeader = document.getElementById("riskHeader");
  const riskBadge = document.getElementById("riskBadge");
  const riskLevelText = document.getElementById("riskLevelText");
  const beginnerExplanation = document.getElementById("beginnerExplanation");
  const redFlagsList = document.getElementById("redFlagsList");
  const reasonsList = document.getElementById("reasonsList");
  const safeActionsList = document.getElementById("safeActionsList");

  // Status indicator
  const apiStatusDot = document.getElementById("apiStatusDot");
  const apiStatusLabel = document.getElementById("apiStatusLabel");

  // ---------------------------------------------------------------------------
  // 2. Application State & Constants
  // ---------------------------------------------------------------------------
  let selectedFile = null;
  let isAnalyzing = false;
  let loadingInterval = null;

  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
  const ALLOWED_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];

  const SAMPLE_TEXTS = {
    bank: "Your bank account will be blocked today! Verify your account immediately using the link below to avoid suspension: https://secure-bank-verify-alert.net/auth",
    delivery: "Your parcel #US-88291 cannot be delivered due to an unpaid customs fee of $2.30. Update your payment details immediately at https://parcel-track-update.com/pay or item will be returned.",
    job: "Congratulations! You have been selected for a high-paying remote data assistant position ($80/hr). Contact our hiring manager on Telegram @FastJobHR immediately to claim your signing bonus."
  };

  const PROGRESS_MESSAGES = [
    "Extracting communication markers and text...",
    "Inspecting sender identity, URLs, and urgency cues...",
    "Querying Google Gemma 4 threat reasoning engine...",
    "Analyzing deception patterns and potential fraud...",
    "Compiling safe recommendations and protective steps..."
  ];

  // ---------------------------------------------------------------------------
  // 3. Backend Health Verification
  // ---------------------------------------------------------------------------
  async function checkBackendHealth() {
    try {
      const response = await fetch("/api/health");
      if (response.ok) {
        const data = await response.json();
        if (apiStatusLabel) {
          apiStatusLabel.textContent = `${data.model || "Gemma 4"} Ready`;
        }
      } else {
        markStatusDegraded();
      }
    } catch {
      markStatusDegraded();
    }
  }

  function markStatusDegraded() {
    if (apiStatusDot) {
      apiStatusDot.style.backgroundColor = "#F59E0B";
      apiStatusDot.style.boxShadow = "0 0 8px #F59E0B";
    }
    if (apiStatusLabel) {
      apiStatusLabel.textContent = "Service Connecting...";
    }
  }

  checkBackendHealth();

  // ---------------------------------------------------------------------------
  // 4. Image Upload & Drag-and-Drop Handling
  // ---------------------------------------------------------------------------
  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function handleFileSelected(file) {
    clearFormError();

    if (!file) {
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      showFormError("Unsupported file format. Please upload a PNG, JPEG, or WEBP image.");
      clearImage();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showFormError("File size exceeds 15MB. Please choose a smaller screenshot.");
      clearImage();
      return;
    }

    selectedFile = file;

    // Show image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      previewName.textContent = file.name;
      previewSize.textContent = formatFileSize(file.size);
      dropzoneEmpty.hidden = true;
      dropzonePreview.hidden = false;
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    selectedFile = null;
    imageInput.value = "";
    previewImage.src = "";
    previewName.textContent = "";
    previewSize.textContent = "";
    dropzoneEmpty.hidden = false;
    dropzonePreview.hidden = true;
  }

  // Click on dropzone opens native file picker
  dropZone.addEventListener("click", (e) => {
    // If the click is on the remove button, let its handler take care of it
    if (e.target.closest("#removeImageBtn")) {
      return;
    }
    imageInput.click();
  });

  // Keyboard accessibility: Enter or Space opens file picker
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      imageInput.click();
    }
  });

  imageInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  removeImageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearImage();
  });

  // Drag-and-drop listeners
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("drag-active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drag-active");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFileSelected(dt.files[0]);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Sample Prompts Support
  // ---------------------------------------------------------------------------
  sampleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const sampleKey = btn.getAttribute("data-sample");
      if (SAMPLE_TEXTS[sampleKey]) {
        textInput.value = SAMPLE_TEXTS[sampleKey];
        clearFormError();
        textInput.focus();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Form Submission & API Integration
  // ---------------------------------------------------------------------------
  function showFormError(message) {
    formErrorMessage.textContent = message;
    formError.hidden = false;
  }

  function clearFormError() {
    formErrorMessage.textContent = "";
    formError.hidden = true;
  }

  function setLoading(loading) {
    isAnalyzing = loading;
    analyzeBtn.disabled = loading;
    resetBtn.disabled = loading;

    if (loading) {
      btnText.textContent = "Analyzing...";
      btnSpinner.hidden = false;
      loadingIndicator.hidden = false;
      emptyResultsState.hidden = true;
      resultsCard.hidden = true;

      // Cycle through scanning phase messages
      let step = 0;
      loadingStatusText.textContent = PROGRESS_MESSAGES[0];
      loadingInterval = setInterval(() => {
        step = (step + 1) % PROGRESS_MESSAGES.length;
        loadingStatusText.textContent = PROGRESS_MESSAGES[step];
      }, 1800);
    } else {
      btnText.textContent = "Analyze for Scams";
      btnSpinner.hidden = true;
      loadingIndicator.hidden = true;
      if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
      }
    }
  }

  scamForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (isAnalyzing) return;

    clearFormError();

    const textValue = textInput.value.trim();
    const hasText = textValue.length > 0;
    const hasImage = selectedFile !== null;

    if (!hasText && !hasImage) {
      showFormError("Please provide a suspicious message text or upload a screenshot to analyze.");
      textInput.focus();
      return;
    }

    // Build standard FormData payload
    // Browser automatically sets Content-Type to multipart/form-data with boundary
    const formData = new FormData();
    if (hasText) {
      formData.append("text", textValue);
    }
    if (hasImage) {
      formData.append("image", selectedFile);
    }

    setLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data || !data.success) {
        const errorMsg = data && data.error 
          ? data.error 
          : `Server returned error (${response.status}). Please try again.`;
        showFormError(errorMsg);
        emptyResultsState.hidden = false;
        resultsCard.hidden = true;
        return;
      }

      // Successful analysis received
      renderAnalysisResults(data.analysis);

    } catch (err) {
      showFormError("Unable to reach the analysis service. Please check your connection and ensure the backend is running.");
      emptyResultsState.hidden = false;
      resultsCard.hidden = true;
    } finally {
      setLoading(false);
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Safe DOM Rendering of Analysis Output (No innerHTML)
  // ---------------------------------------------------------------------------
  function renderAnalysisResults(analysis) {
    if (!analysis) return;

    // 1. Risk Level State
    const riskLevel = String(analysis.risk_level || "UNKNOWN").toUpperCase();
    riskLevelText.textContent = `${riskLevel} RISK`;

    // Clear previous risk classes
    riskBadge.classList.remove("risk-state-high", "risk-state-med", "risk-state-low");

    if (riskLevel === "HIGH") {
      riskBadge.classList.add("risk-state-high");
    } else if (riskLevel === "MEDIUM") {
      riskBadge.classList.add("risk-state-med");
    } else {
      riskBadge.classList.add("risk-state-low");
    }

    // 2. Beginner-Friendly Explanation (Safe textContent)
    beginnerExplanation.textContent = analysis.beginner_explanation || "No explanation provided.";

    // 3. Observed Red Flags List (Safe DOM creation)
    redFlagsList.replaceChildren();
    const flags = Array.isArray(analysis.red_flags) ? analysis.red_flags : [];
    if (flags.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "empty-items-notice";
      emptyLi.textContent = "No overt red flags detected in the provided input.";
      redFlagsList.appendChild(emptyLi);
    } else {
      flags.forEach((flagText) => {
        const li = document.createElement("li");
        li.textContent = String(flagText);
        redFlagsList.appendChild(li);
      });
    }

    // 4. Underlying Reasons List (Safe DOM creation)
    reasonsList.replaceChildren();
    const reasons = Array.isArray(analysis.reasons) ? analysis.reasons : [];
    if (reasons.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "empty-items-notice";
      emptyLi.textContent = "No specific suspicious indicators found.";
      reasonsList.appendChild(emptyLi);
    } else {
      reasons.forEach((reasonText) => {
        const li = document.createElement("li");
        li.textContent = String(reasonText);
        reasonsList.appendChild(li);
      });
    }

    // 5. Recommended Safe Actions Checklist (Safe DOM creation)
    safeActionsList.replaceChildren();
    const actions = Array.isArray(analysis.safe_actions) ? analysis.safe_actions : [];
    if (actions.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "empty-items-notice";
      emptyLi.textContent = "Standard caution applies. Verify through official channels.";
      safeActionsList.appendChild(emptyLi);
    } else {
      actions.forEach((actionText) => {
        const li = document.createElement("li");

        // SVG checkmark icon
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "action-check-icon");
        svg.setAttribute("viewBox", "0 0 20 20");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("aria-hidden", "true");

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("fill-rule", "evenodd");
        path.setAttribute("d", "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z");
        path.setAttribute("clip-rule", "evenodd");
        svg.appendChild(path);

        const span = document.createElement("span");
        span.textContent = String(actionText);

        li.appendChild(svg);
        li.appendChild(span);
        safeActionsList.appendChild(li);
      });
    }

    // Reveal results and smoothly scroll into view
    emptyResultsState.hidden = true;
    resultsCard.hidden = false;
    resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------------------------------------------------------------------
  // 8. Form & Results Reset
  // ---------------------------------------------------------------------------
  resetBtn.addEventListener("click", () => {
    textInput.value = "";
    clearImage();
    clearFormError();
    emptyResultsState.hidden = false;
    resultsCard.hidden = true;
    textInput.focus();
  });
});
