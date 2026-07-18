"""
transcriber.py — Phase 2: Audio Transcription with OpenAI Whisper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 LEARNING GUIDE — How Whisper Works
──────────────────────────────────────
Whisper is a sequence-to-sequence Transformer model trained on 680,000
hours of multilingual audio. Here's the full pipeline:

1. AUDIO EXTRACTION (ffmpeg / moviepy):
   Video files contain both video streams and audio streams.
   We extract only the audio track as a WAV file (16kHz mono).
   Why WAV? It's uncompressed — Whisper reads raw PCM waveform data.
   Why 16kHz? That's what Whisper was trained on. Higher = wasted data.
   Why mono? Speech understanding doesn't need stereo.

2. MEL SPECTROGRAM:
   Whisper converts the raw audio waveform into a mel spectrogram —
   a 2D image where:
     • X axis = time
     • Y axis = frequency (mel scale, which matches human hearing)
     • Pixel brightness = loudness at that frequency/time
   This converts an audio problem into an image problem!

3. ENCODER (Visual Transformer):
   The mel spectrogram is passed through a Visual Transformer encoder
   (similar to how ViT processes images). It produces a compressed
   contextual representation of the entire audio.

4. DECODER (Text Transformer):
   An autoregressive text decoder predicts tokens one by one,
   attending to the encoder output. It knows about language,
   context, and even punctuation.

5. OUTPUT:
   Whisper returns segments with:
     • "text"  — the transcribed words
     • "start" — start time in seconds
     • "end"   — end time in seconds

Available model sizes (tradeoff: accuracy vs. speed vs. memory):
  tiny   (~39MB)  — fastest, lowest accuracy
  base   (~140MB) — good for short clips (WE USE THIS)
  small  (~460MB) — better accuracy, ~2x slower
  medium (~1.5GB) — very accurate
  large  (~3GB)   — best, needs GPU

📚 WHY moviepy FOR AUDIO EXTRACTION?
   moviepy is a Python wrapper around ffmpeg. ffmpeg is the industry
   standard for video/audio manipulation. We use moviepy's Python API
   to avoid shell command injection risks and get proper error handling.
"""

import os
import tempfile
import whisper
from pathlib import Path
from typing import Optional
from backend.src.config import WHISPER_MODEL, TEMP_DIR

# ── Singleton model cache ─────────────────────────────────────────────────────
# Loading a Whisper model takes ~3-5 seconds (reading ~140MB from disk).
# We cache it at module level so it's only loaded ONCE per server startup,
# not on every transcription request.
_whisper_model = None

def _get_model():
    """Lazy-load Whisper model (singleton pattern)."""
    global _whisper_model
    if _whisper_model is None:
        # whisper.load_model downloads the model on first run,
        # then caches it in ~/.cache/whisper/
        print(f"┌── Whisper model load process ────────────────")
        print(f"│ Model: '{WHISPER_MODEL}'")
        print(f"│ Action: Loading from disk (or downloading if first run)...")
        _whisper_model = whisper.load_model(WHISPER_MODEL)
        print(f"│ Status: Loaded successfully!")
        print(f"└──────────────────────────────────────────────")
    return _whisper_model


def extract_audio(video_path: Path | str, job_id: str) -> Optional[Path]:
    """
    Extract the audio track from a video file as a 16kHz mono WAV.

    Returns:
        Path to the extracted .wav file, or None if extraction fails.

    📚 Why 16kHz mono WAV?
        • 16kHz = 16,000 samples per second. Enough to capture all speech
          frequencies (human voice: 300Hz–3400Hz, well within Nyquist limit).
        • Mono = one channel. Speech understanding is independent of spatial audio.
        • WAV = uncompressed PCM. No codec artifacts that could confuse Whisper.
    """
    video_path = Path(video_path)
    if not video_path.exists():
        return None

    audio_dir  = TEMP_DIR / job_id
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = audio_dir / "audio.wav"

    try:
        # moviepy approach — cleaner Python API than raw ffmpeg subprocess
        from moviepy import VideoFileClip

        # Load the video — moviepy reads it into memory-mapped segments
        with VideoFileClip(str(video_path)) as clip:
            if clip.audio is None:
                # Some videos (screen recordings, etc.) have no audio track
                return None

            # write_audiofile exports audio as WAV at 16000 Hz, mono
            # ffmpeg_params forces the sample rate to exactly 16kHz
            clip.audio.write_audiofile(
                str(audio_path),
                fps=16000,        # Sample rate Whisper expects
                nbytes=2,         # 16-bit PCM (standard WAV)
                codec="pcm_s16le",# Uncompressed PCM, Little-Endian
                ffmpeg_params=["-ac", "1"],  # -ac 1 = mono (1 audio channel)
                logger=None,      # Suppress moviepy's verbose output
            )
        return audio_path

    except Exception as e:
        print(f"[transcriber] Audio extraction failed: {e}")
        return None


def transcribe_audio(
    audio_path: Path | str,
    language: str = "en",
    progress_callback=None
) -> dict:
    """
    Transcribe an audio file using Whisper.

    Args:
        audio_path:        Path to a WAV (or MP3/M4A) audio file.
        language:          ISO language code. "en"=English, "ja"=Japanese, etc.
                           Set to None to let Whisper auto-detect.
        progress_callback: Optional callable(str) for live status updates.

    Returns:
        {
          "full_text":   "Hello, welcome to my channel...",
          "word_count":  42,
          "duration":    58.3,
          "language":    "en",
          "segments": [
            { "text": "Hello, welcome", "start": 0.0, "end": 1.5 },
            ...
          ]
        }

    📚 The "segments" key is powerful for future features:
        You could highlight words in a player, sync captions, or
        even detect "filler words" (um, uh, like) per second.
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    audio_path = Path(audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    log("Loading Whisper model (first run downloads ~140MB)…")
    model = _get_model()

    log("Transcribing audio — this takes ~10-30 seconds on CPU…")

    # whisper.transcribe() does everything:
    #   1. Reads the WAV file
    #   2. Builds the mel spectrogram internally
    #   3. Runs the encoder + decoder
    #   4. Returns segments with timestamps
    result = model.transcribe(
        str(audio_path),
        language=language or None,   # None = auto-detect language
        verbose=False,               # Don't print progress to stdout
        word_timestamps=False,       # Word-level timing (slower, not needed now)
        condition_on_previous_text=True,  # Use context for better accuracy
        temperature=0,               # 0 = greedy decoding (most likely token)
                                     # Higher values introduce randomness
    )

    # ── Build our structured output ───────────────────────────────────────────
    full_text  = result.get("text", "").strip()
    segments   = result.get("segments", [])
    lang       = result.get("language", language)

    # Calculate approximate duration from last segment
    duration = segments[-1]["end"] if segments else 0.0

    # Simplify segments for storage (Whisper returns a lot of extra fields)
    clean_segments = [
        {
            "text":  seg["text"].strip(),
            "start": round(seg["start"], 2),
            "end":   round(seg["end"], 2),
        }
        for seg in segments
    ]

    word_count = len(full_text.split()) if full_text else 0

    log(f"Transcription complete: {word_count} words, {len(clean_segments)} segments")

    return {
        "full_text":  full_text,
        "word_count": word_count,
        "duration":   round(duration, 2),
        "language":   lang,
        "segments":   clean_segments,
    }


def transcribe_video(
    video_path: Path | str,
    job_id: str,
    progress_callback=None
) -> dict:
    """
    High-level convenience function: extract audio then transcribe.
    This is what main.py calls.
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    log("Extracting audio track from video…")
    audio_path = extract_audio(video_path, job_id)

    if audio_path is None:
        log("No audio track found — skipping transcription")
        return {
            "full_text":  "",
            "word_count": 0,
            "duration":   0.0,
            "language":   "unknown",
            "segments":   [],
        }

    log(f"Audio extracted to {audio_path.name}")
    return transcribe_audio(audio_path, progress_callback=log)
