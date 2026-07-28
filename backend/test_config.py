import sys
from pathlib import Path

# Add project root to sys.path for direct script execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.config import GEMINI_API_KEY, WHISPER_MODEL, FRAME_SAMPLE_RATE, MINIMAX_API_KEY, SAKANA_API_KEY
print("Config Values:")
print(f"  GEMINI_API_KEY:  {'SET (' + str(len(GEMINI_API_KEY)) + ' chars)' if GEMINI_API_KEY else 'NOT SET'}")
print(f"  SAKANA_API_KEY:  {'SET (' + str(len(SAKANA_API_KEY)) + ' chars)' if SAKANA_API_KEY else 'NOT SET'}")
print(f"  MINIMAX_API_KEY: {'SET (' + str(len(MINIMAX_API_KEY)) + ' chars)' if MINIMAX_API_KEY else 'NOT SET'}")
print(f"  WHISPER_MODEL:   {WHISPER_MODEL}")
print(f"  FRAME_SAMPLE_RATE: {FRAME_SAMPLE_RATE}s")
print("\nAll imports successful!")
