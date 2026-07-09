"""
config.py — Application configuration, environment variable loading,
and guaranteed directory setup for ClipInsight AI backend.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env")

def get_env_with_registry_fallback(key: str, default: str = "") -> str:
    """Gets an environment variable, falling back to the Windows registry if not set in the process env."""
    val = os.getenv(key, "")
    if val:
        return val
    try:
        import winreg
        reg_key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment")
        val, _ = winreg.QueryValueEx(reg_key, key)
        return val
    except Exception:
        pass
    return default

# ── API Keys ──────────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = get_env_with_registry_fallback("GEMINI_API_KEY", "")
OPENAI_API_KEY: str = get_env_with_registry_fallback("OPENAI_API_KEY", "")   # Whisper fallback

# Sakana AI (Fugu / Fugu Ultra) — OpenAI-compatible API
# Console: https://console.sakana.ai
SAKANA_API_KEY:  str = get_env_with_registry_fallback("SAKANA_API_KEY", "")
SAKANA_BASE_URL: str = "https://api.sakana.ai/v1"

# Z.ai / Zhipu AI (GLM-5.2) — OpenAI-compatible API
# Console: https://z.ai
ZAI_API_KEY:  str = get_env_with_registry_fallback("ZAI_API_KEY", "")
ZAI_BASE_URL: str = "https://api.z.ai/api/paas/v4"

# MiniMax AI — OpenAI-compatible API
# Console: https://www.minimaxi.com/ (Global: https://api.minimax.io)
MINIMAX_API_KEY:  str = get_env_with_registry_fallback("MINIMAX_API_KEY", "")
MINIMAX_BASE_URL: str = "https://api.minimax.io/v1"

# OpenRouter AI — OpenAI-compatible API with Free Models option
# Console: https://openrouter.ai/
OPENROUTER_API_KEY:  str = get_env_with_registry_fallback("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL:    str = get_env_with_registry_fallback("OPENROUTER_MODEL", "google/gemini-2.5-flash:free")


# ── Directory Paths ───────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent.parent          # /backend
TEMP_DIR   = BASE_DIR / "temp"
DATA_DIR   = BASE_DIR / "data"

# ── Constraints ───────────────────────────────────────────────────────────────
MAX_VIDEO_SIZE_MB: int = 200   # Hard cap on download size
# Frame rate: 3s = ~20 candidate frames for 60s video (scene detection reduces further)
# Lower = more frames = slower analysis. 3 is optimal for short-form content.
_env_frame_rate = get_env_with_registry_fallback("FRAME_SAMPLE_RATE", "3")
FRAME_SAMPLE_RATE: int = int(_env_frame_rate) if _env_frame_rate.isdigit() else 3
# Whisper model size: tiny (~2-5s on CPU), base (~10-30s), small, medium, large
_env_whisper = get_env_with_registry_fallback("WHISPER_MODEL", "tiny")
WHISPER_MODEL: str = _env_whisper if _env_whisper in ("tiny", "base", "small", "medium", "large") else "tiny"

# ── Ensure directories exist ──────────────────────────────────────────────────
for _dir in [TEMP_DIR, DATA_DIR]:
    _dir.mkdir(parents=True, exist_ok=True)
