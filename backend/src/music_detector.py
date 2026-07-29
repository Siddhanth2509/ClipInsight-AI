"""
music_detector.py — Music Identification via Shazam API (WASM Node.js runner)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import subprocess
import tempfile
import os
import json
from pathlib import Path

def detect_music_from_video(video_path, progress_callback=None) -> dict:
    """
    Identify background music in a video using the WebAssembly-based Shazam runner.

    Args:
        video_path:        Path to the video file (str or Path).
        progress_callback: Optional callable(str) for status updates.

    Returns:
        dict with detected=True and song metadata, or detected=False with reason.
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    video_path = Path(video_path)
    if not video_path.exists():
        return {"detected": False, "reason": "Video file not found"}

    # ── Step 1: Extract 10 seconds of raw PCM audio (starting at offset 3s to skip intro speech) ──
    log("Extracting audio snippet for music identification…")
    
    def _extract_and_recognize(start_sec: float = 3.0) -> dict:
        tmp_wav = None
        try:
            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_wav = tmp.name
            tmp.close()

            cmd = [
                "ffmpeg", "-y", "-loglevel", "error",
                "-ss", str(start_sec), # Skip intro talk/noise to target core music track
                "-i", str(video_path),
                "-t", "10",            # 10s is optimal for fast Shazam matching
                "-ac", "1",            # Mono
                "-ar", "16000",        # 16 kHz
                "-acodec", "pcm_s16le",
                "-vn",
                tmp_wav,
            ]
            r = subprocess.run(cmd, capture_output=True, timeout=12)
            if r.returncode != 0:
                if tmp_wav and os.path.exists(tmp_wav):
                    os.unlink(tmp_wav)
                return {"detected": False, "reason": "Audio extraction failed"}

            recognize_js = Path(__file__).parent / "recognize.mjs"
            backend_dir = Path(__file__).parent.parent
            
            node_cmd = ["node", str(recognize_js), tmp_wav]
            res = subprocess.run(
                node_cmd,
                capture_output=True,
                text=True,
                cwd=str(backend_dir),
                timeout=12
            )
            
            if tmp_wav and os.path.exists(tmp_wav):
                os.unlink(tmp_wav)

            stdout_str = res.stdout.strip()
            if not stdout_str:
                return {"detected": False, "reason": "No output from recognition engine"}
                
            data = json.loads(stdout_str)
            if not data or not isinstance(data, dict) or "error" in data:
                return {"detected": False, "reason": "No match found"}
                
            track = data.get("track")
            if not track:
                return {"detected": False, "reason": "No music match found"}

            album = ""
            for section in track.get("sections", []):
                if section.get("type") == "SONG":
                    for meta in section.get("metadata", []):
                        if meta.get("title") == "Album":
                            album = meta.get("text", "")
                            break
                            
            return {
                "detected": True,
                "song_title": track.get("title", ""),
                "artist": track.get("subtitle", ""),
                "album": album,
                "genre": track.get("genres", {}).get("primary", ""),
                "cover_art_url": track.get("images", {}).get("coverart", ""),
                "shazam_url": track.get("url", "")
            }
        except Exception as err:
            if tmp_wav and os.path.exists(tmp_wav):
                os.unlink(tmp_wav)
            return {"detected": False, "reason": str(err)}

    log("Querying Shazam database via WASM engine (offset 3s)…")
    res1 = _extract_and_recognize(start_sec=3.0)
    if res1.get("detected"):
        log(f"Music identified: '{res1['song_title']}' by {res1['artist']}")
        return res1

    # Secondary attempt at start of video (offset 0s)
    log("Querying Shazam database (offset 0s)…")
    res2 = _extract_and_recognize(start_sec=0.0)
    if res2.get("detected"):
        log(f"Music identified: '{res2['song_title']}' by {res2['artist']}")
        return res2

    return {"detected": False, "reason": "No music match found across offsets"}
