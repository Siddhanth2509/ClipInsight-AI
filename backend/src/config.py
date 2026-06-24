"""
config.py — Application configuration, environment variable loading,
and guaranteed directory setup for ClipInsight AI backend.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

# ── API Keys ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")   # Whisper fallback

# Sakana AI (Fugu / Fugu Ultra) — OpenAI-compatible API
# Console: https://console.sakana.ai
SAKANA_API_KEY:  str = os.getenv("SAKANA_API_KEY", "")
SAKANA_BASE_URL: str = "https://api.sakana.ai/v1"

# Z.ai / Zhipu AI (GLM-5.2) — OpenAI-compatible API
# Console: https://z.ai
ZAI_API_KEY:  str = os.getenv("ZAI_API_KEY", "")
ZAI_BASE_URL: str = "https://api.z.ai/api/paas/v4"

# ── Directory Paths ───────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent.parent          # /backend
TEMP_DIR   = BASE_DIR / "temp"
DATA_DIR   = BASE_DIR / "data"

# ── Constraints ───────────────────────────────────────────────────────────────
MAX_VIDEO_SIZE_MB: int = 200   # Hard cap on download size
FRAME_SAMPLE_RATE: int = 2     # Extract 1 frame every N seconds
WHISPER_MODEL: str = "base"    # Options: tiny, base, small, medium, large

# ── Ensure directories exist ──────────────────────────────────────────────────
for _dir in [TEMP_DIR, DATA_DIR]:
    _dir.mkdir(parents=True, exist_ok=True)
