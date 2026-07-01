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

    # ── Step 1: Extract 12 seconds of raw PCM audio ──────────────────────────
    log("Extracting audio for music identification…")
    tmp_wav = None
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_wav = tmp.name
        tmp.close()

        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-i", str(video_path),
            "-t", "12",          # Shazam matches best with ~10-12s snippet
            "-ac", "1",          # Mono
            "-ar", "16000",      # 16 kHz
            "-acodec", "pcm_s16le",
            "-vn",
            tmp_wav,
        ]
        r = subprocess.run(cmd, capture_output=True, timeout=30)
        if r.returncode != 0:
            return {"detected": False, "reason": f"Audio extraction failed: {r.stderr.decode('utf-8', errors='ignore')}"}

    except Exception as e:
        if tmp_wav and os.path.exists(tmp_wav):
            os.unlink(tmp_wav)
        return {"detected": False, "reason": f"Audio extraction error: {e}"}

    # ── Step 2: Run Node.js Shazam identification ───────────────────────────
    log("Querying Shazam database via WASM engine…")
    try:
        recognize_js = Path(__file__).parent / "recognize.mjs"
        backend_dir = Path(__file__).parent.parent
        
        node_cmd = [
            "node",
            str(recognize_js),
            tmp_wav
        ]
        
        # Run with working directory in backend so node_modules resolves correctly
        res = subprocess.run(
            node_cmd,
            capture_output=True,
            text=True,
            cwd=str(backend_dir),
            timeout=20
        )
        
        if tmp_wav and os.path.exists(tmp_wav):
            os.unlink(tmp_wav)
            
        stdout_str = res.stdout.strip()
        if not stdout_str:
            err_msg = res.stderr.strip() or "No output from recognition engine."
            return {"detected": False, "reason": f"Music service error: {err_msg}"}
            
        data = json.loads(stdout_str)
        if not data or not isinstance(data, dict):
            return {"detected": False, "reason": "No music match found"}
        if "error" in data:
            return {"detected": False, "reason": f"Recognition failed: {data['error']}"}
            
        track = data.get("track")
        if not track:
            return {"detected": False, "reason": "No music match found"}
            
        # Parse album name from sections if present
        album = ""
        for section in track.get("sections", []):
            if section.get("type") == "SONG":
                for meta in section.get("metadata", []):
                    if meta.get("title") == "Album":
                        album = meta.get("text", "")
                        break
                        
        result = {
            "detected": True,
            "song_title": track.get("title", ""),
            "artist": track.get("subtitle", ""),
            "album": album,
            "genre": track.get("genres", {}).get("primary", ""),
            "cover_art_url": track.get("images", {}).get("coverart", ""),
            "shazam_url": track.get("url", "")
        }
        
        log(f"Music identified: '{result['song_title']}' by {result['artist']}")
        return result

    except Exception as e:
        if tmp_wav and os.path.exists(tmp_wav):
            os.unlink(tmp_wav)
        return {"detected": False, "reason": f"Music identification failed: {e}"}
