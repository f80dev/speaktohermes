#!/usr/bin/env python3
"""
STT Proxy Server for SpeakToHermes Angular app.
Receives audio from the browser, transcribes with faster-whisper, returns text.
Runs on port 8787.
"""

import base64
import io
import logging
import tempfile
import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Enable CORS for Angular dev server
CORS(app)

# Load faster-whisper model once at startup
MODEL = os.environ.get("STT_MODEL", "base")
MODEL_DIR = os.environ.get("STT_MODEL_DIR", None)

logger.info(f"Loading faster-whisper model: {MODEL}")
try:
    if MODEL_DIR:
        model = WhisperModel(MODEL, download_root=MODEL_DIR)
    else:
        model = WhisperModel(MODEL)
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    model = None


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """Receive audio bytes, transcribe, return text."""
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500

    try:
        data = request.get_json()
        audio_b64 = data.get("audio", "")

        if not audio_b64:
            # Try as raw bytes in content-type application/octet-stream
            audio_bytes = request.data
            if not audio_bytes:
                return jsonify({"error": "No audio data"}), 400
        else:
            audio_bytes = base64.b64decode(audio_b64)

        # Write to temp file for faster-whisper
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            # Transcribe
            segments, info = model.transcribe(
                temp_path,
                language="fr",
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )

            text = " ".join(segment.text for segment in segments).strip()
            logger.info(f"Transcribed: {text[:100]}")

            return jsonify({
                "text": text,
                "language": info.language,
                "language_probability": info.language_probability
            })
        finally:
            os.unlink(temp_path)

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    status = "ok" if model is not None else "model_not_loaded"
    return jsonify({"status": status, "model": MODEL})


if __name__ == "__main__":
    port = int(os.environ.get("STT_PORT", 8787))
    logger.info(f"Starting STT server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)