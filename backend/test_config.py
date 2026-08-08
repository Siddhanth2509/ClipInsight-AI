import sys
from pathlib import Path

# Add project root to sys.path for direct script execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.config import GEMINI_API_KEY, OPENROUTER_API_KEY, WHISPER_MODEL, FRAME_SAMPLE_RATE, MINIMAX_API_KEY, SAKANA_API_KEY, PRIMARY_VISION_PROVIDER
print("Config Values:")
print(f"  PRIMARY VISION:   {PRIMARY_VISION_PROVIDER.upper()}")
print(f"  OPENROUTER_KEY:  {'SET (' + str(len(OPENROUTER_API_KEY)) + ' chars)' if OPENROUTER_API_KEY else 'NOT SET'}")
print(f"  GEMINI_API_KEY:  {'SET (' + str(len(GEMINI_API_KEY)) + ' chars)' if GEMINI_API_KEY else 'NOT SET'}")
print(f"  SAKANA_API_KEY:  {'SET (' + str(len(SAKANA_API_KEY)) + ' chars)' if SAKANA_API_KEY else 'NOT SET'}")
print(f"  MINIMAX_API_KEY: {'SET (' + str(len(MINIMAX_API_KEY)) + ' chars)' if MINIMAX_API_KEY else 'NOT SET'}")
print(f"  WHISPER_MODEL:   {WHISPER_MODEL}")
from backend.src.video_processor import detect_frame_blur, retry_with_exponential_backoff
print(f"  BLUR FILTERING:   ENABLED (threshold=100.0)")
print(f"  RETRY DECORATOR:  ENABLED (full jitter backoff)")
print("\nAll config checks and imports successful!")
