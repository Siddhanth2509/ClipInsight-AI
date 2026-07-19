"""
frame_extractor.py — Phase 2: Intelligent Video Frame Sampling
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 LEARNING GUIDE — How This Works
────────────────────────────────────
A video is simply a sequence of images (frames) played at high speed.
A 60-second Instagram Reel at 30fps = 1,800 frames.

Sending ALL frames to an AI would be:
  • Extremely slow (API latency per image)
  • Very expensive (Gemini charges per image token)
  • Redundant (frame 47 and frame 48 look virtually identical)

SOLUTION: Smart Temporal Sampling
  1. Extract 1 frame every SAMPLE_EVERY_N_SECONDS seconds
  2. Apply Scene Change Detection: skip frames that look too similar
     to the previous one (measured via pixel difference)

How Scene Change Detection Works:
  • Convert frame to grayscale (single channel, faster math)
  • Resize to tiny thumbnail (64x64) to ignore minor noise
  • Compute absolute pixel difference vs. previous accepted frame
  • If mean diff < SCENE_CHANGE_THRESHOLD → frames are visually similar → SKIP
  • If mean diff ≥ threshold → new scene detected → KEEP

This means a video with slow-panning shots keeps fewer frames,
while a fast-cut video (like a Reel) keeps more — exactly what we want.
"""

import os
import cv2
import numpy as np
from pathlib import Path
from typing import List
from backend.src.config import TEMP_DIR, FRAME_SAMPLE_RATE


# ── Tuning Constants ──────────────────────────────────────────────────────────
# How many seconds between each candidate frame
SAMPLE_EVERY_N_SECONDS: int = FRAME_SAMPLE_RATE   # default: 2 seconds

# If average pixel diff is below this, two frames are considered "the same".
# Range: 0–255. Lower = more strict (fewer frames). Higher = keep more frames.
SCENE_CHANGE_THRESHOLD: float = 8.0

# 📚 Downscaling & Grayscale Rationale:
#   Converting the frame to grayscale discards color variance (saving GPU/CPU channels).
#   Downscaling to 64x64 collapses high-frequency compression noise (encoding block artifacts)
#   so only macro visual changes trigger scene detections.
COMPARE_SIZE = (64, 64)

# Max frames to extract per video (safety cap)
MAX_FRAMES: int = 40


def extract_frames(
    video_path: Path | str,
    job_id: str,
    progress_callback=None
) -> List[dict]:
    """
    Extract a smart subset of frames from a video file.

    Args:
        video_path:        Path to the input video file.
        job_id:            Unique job identifier (frames saved here).
        progress_callback: Optional callable(str) for live status updates.

    Returns:
        List of dicts:
        [
          { "path": "relative/path/frame_0.jpg",
            "timestamp": 2.0,
            "index": 0 },
          ...
        ]

    📚 Why return dicts instead of just paths?
        Timestamps are critical context for the AI. Telling Gemini
        "this frame is from second 2.5" helps it understand pacing,
        hook timing, and narrative structure.
    """

    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    video_path = Path(video_path)
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    # ── Create output directory for this job's frames ─────────────────────────
    frames_dir = TEMP_DIR / job_id / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    # ── Open the video with OpenCV ────────────────────────────────────────────
    # cv2.VideoCapture opens a video file or stream.
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise RuntimeError(f"OpenCV could not open video: {video_path}")

    # ── Read video metadata ───────────────────────────────────────────────────
    # CAP_PROP_FPS  = frames per second (e.g., 30.0)
    # CAP_PROP_FRAME_COUNT = total number of frames
    fps         = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_s  = total_frames / fps

    log(f"Video opened: {duration_s:.1f}s @ {fps:.1f}fps ({total_frames} frames total)")

    # ── Calculate the frame interval ──────────────────────────────────────────
    # If FPS=30 and SAMPLE_EVERY_N_SECONDS=2, we check every 60th frame.
    frame_interval = max(1, int(fps * SAMPLE_EVERY_N_SECONDS))

    extracted = []              # Output list
    prev_gray = None            # Previous accepted frame (for scene comparison)
    frame_idx = 0               # Current frame position

    log(f"Sampling every {SAMPLE_EVERY_N_SECONDS}s (every {frame_interval} frames)")

    # ── Main extraction loop ──────────────────────────────────────────────────
    while True:
        # Jump directly to the next candidate frame position.
        # This is much faster than reading frame-by-frame.
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)

        # cap.read() returns:
        #   success (bool) — whether a frame was actually read
        #   frame  (ndarray) — the raw BGR image (Blue-Green-Red, not RGB!)
        success, frame = cap.read()

        if not success:
            break   # End of video

        # ── Scene Change Detection ────────────────────────────────────────────
        # Convert BGR → Grayscale. Pixel diff on single channel = 3x faster.
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Downscale to 64x64 thumbnail. Small differences in large frames
        # (camera noise, compression artifacts) don't affect this check.
        gray_small = cv2.resize(gray, COMPARE_SIZE)

        if prev_gray is not None:
            # np.abs(a - b) → absolute pixel difference matrix
            # .mean() → average across all pixels (0–255 range)
            diff = np.abs(gray_small.astype(np.int16) - prev_gray.astype(np.int16))
            mean_diff = diff.mean()

            if mean_diff < SCENE_CHANGE_THRESHOLD:
                # Frames are too similar — skip this one
                frame_idx += frame_interval
                continue

        # ── Keep this frame ───────────────────────────────────────────────────
        prev_gray = gray_small
        timestamp = frame_idx / fps

        # Build output filename: frame_000_at_2.5s.jpg
        out_name  = f"frame_{len(extracted):03d}_at_{timestamp:.1f}s.jpg"
        out_path  = frames_dir / out_name

        # cv2.imwrite saves the frame as JPEG.
        # Quality 85 = good visual quality, ~3-5x smaller than quality 100.
        cv2.imwrite(str(out_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

        # Store relative path (so the frontend can build the URL)
        rel_path = f"{job_id}/frames/{out_name}"
        extracted.append({
            "path":      rel_path,
            "timestamp": round(timestamp, 2),
            "index":     len(extracted),
        })

        log(f"  → Frame {len(extracted)} captured at {timestamp:.1f}s")

        # Safety cap — never extract more than MAX_FRAMES
        if len(extracted) >= MAX_FRAMES:
            log(f"  Max frame limit ({MAX_FRAMES}) reached — stopping early")
            break

        frame_idx += frame_interval

    cap.release()   # Always release the video capture — frees file handles

    log(f"Frame extraction complete: {len(extracted)} frames from {duration_s:.1f}s video")
    return extracted
