"""
video_processor.py — Video downloading (yt-dlp) and file saving.

KEY FIX for Windows [Errno 22] — "Invalid argument":
  yt-dlp creates temp/fragment files named after the VIDEO TITLE, not the
  outtmpl. On Windows, titles like "Follow me! 🔥 | Reel" contain illegal
  chars (|, emojis, ?, *, etc.) → [Errno 22] when yt-dlp tries to create
  those temp files on disk.

  Fix applied here:
  1. `paths: {home, temp}` — forces ALL yt-dlp file I/O (including fragment
     temp files .f1, .f2, .ytdl) into the job_dir.
  2. `outtmpl: "clip.%(ext)s"` — hardcoded safe output name.
  3. `nopart: True` — disables .part temp files entirely.
  4. Single-stream format for Instagram/Shorts — avoids the video+audio merge
     step that creates additional intermediate temp files.
"""
import re
import yt_dlp
from pathlib import Path
from backend.src.config import TEMP_DIR, MAX_VIDEO_SIZE_MB


def is_valid_url(url: str) -> bool:
    pattern = re.compile(
        r'^(?:http|ftp)s?://'
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'
        r'localhost|'
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
        r'(?::\d+)?'
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return re.match(pattern, url) is not None


def detect_platform(url: str) -> str:
    """Detect the video platform from a URL."""
    u = url.lower()
    if "instagram.com" in u:
        return "instagram"
    if "tiktok.com" in u:
        return "tiktok"
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "twitter.com" in u or "x.com" in u:
        return "twitter"
    return "generic"


def save_uploaded_file(file_bytes: bytes, filename: str, job_id: str) -> Path:
    """Saves an uploaded video file to a job-specific temp folder."""
    job_dir = TEMP_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    dest = job_dir / filename
    dest.write_bytes(file_bytes)
    return dest


def download_video(url: str, job_id: str, progress_callback=None) -> Path:
    """
    Downloads a video using yt-dlp with platform-aware settings.

    Returns the local Path to the downloaded video file.
    Raises RuntimeError with a friendly code if the download fails.
    """
    if not is_valid_url(url):
        raise ValueError(f"Invalid URL: {url}")

    platform = detect_platform(url)
    job_dir  = TEMP_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    def _progress_hook(d):
        if not progress_callback:
            return
        status = d.get("status", "")
        if status == "downloading":
            pct   = d.get("_percent_str", "?%").strip()
            speed = d.get("_speed_str",   "").strip()
            eta   = d.get("_eta_str",     "").strip()
            progress_callback(f"Downloading [{platform}]: {pct}  {speed}  ETA {eta}")
        elif status == "finished":
            size_kb = d.get("total_bytes", 0) // 1024 or d.get("total_bytes_estimate", 0) // 1024
            progress_callback(f"Download finished ({size_kb} KB), finalizing…")

    # ── Base options shared by all platforms ─────────────────────────────────
    # CRITICAL: `paths` forces ALL yt-dlp file writes (output, temp, fragments)
    # into job_dir. `nopart` disables .part temp files. Together these prevent
    # [Errno 22] "Invalid argument" on Windows caused by video-title-derived
    # temp filenames containing illegal characters like |, :, ?, *, etc.
    base_opts = {
        "outtmpl":   "clip.%(ext)s",      # safe hardcoded name
        "paths": {                         # ALL file I/O goes here
            "home": str(job_dir),
            "temp": str(job_dir),
        },
        "merge_output_format":           "mp4",
        "max_filesize":                  MAX_VIDEO_SIZE_MB * 1024 * 1024,
        "socket_timeout":                30,
        "retries":                       5,
        "fragment_retries":              5,
        "concurrent_fragment_downloads": 4,
        "quiet":                         True,
        "no_warnings":                   True,
        "progress_hooks":                [_progress_hook],
        "noprogress":                    False,
        "nopart":                        True,   # no .part temp files
        "keepvideo":                     False,  # clean up after merge
        "restrictfilenames":             True,   # extra safety layer
        "windowsfilenames":              True,   # strip illegal chars
        "writethumbnail":                False,
        "writeinfojson":                 False,
        "getcomments":                   True,   # extract comments for context clues
        "max_comments":                  30,     # cap at 30 top comments
        "http_headers": {
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        },
    }

    # ── Platform-specific overrides ──────────────────────────────────────────
    if platform == "instagram":
        # SINGLE-STREAM format — avoids ffmpeg merge + no intermediate files.
        # 480p is more than enough for AI frame extraction.
        platform_opts = {
            "format": (
                "best[ext=mp4][height<=480]"
                "/best[ext=mp4][height<=720]"
                "/best[ext=mp4]"
                "/best[height<=480]"
                "/best"
            ),
            "extractor_args": {"instagram": {"api": ["graphql"]}},
            "http_headers": {
                **base_opts["http_headers"],
                "User-Agent": (
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/17.0 Mobile/15E148 Safari/604.1"
                ),
                "Referer": "https://www.instagram.com/",
                "Origin":  "https://www.instagram.com",
            },
        }

    elif platform == "tiktok":
        # App client avoids TikTok watermark
        platform_opts = {
            "format": (
                "best[ext=mp4][height<=720]"
                "/best[ext=mp4]"
                "/best[height<=720]"
                "/best"
            ),
            "extractor_args": {
                "tiktok": {
                    "app_version":      ["27.2.4"],
                    "manifest_app_version": ["1180"],
                }
            },
        }

    elif platform == "youtube":
        # YouTube Shorts + regular videos.
        # Android client: no JS runtime needed → fastest extraction.
        # SINGLE-STREAM preferred to avoid [Errno 22] on merge temp files;
        # falls back to DASH (video+audio) if no combined stream exists.
        platform_opts = {
            "format": (
                "best[ext=mp4][height<=720]"         # Combined stream (no merge)
                "/best[ext=mp4]"                     # Any combined MP4
                "/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]"  # DASH fallback
                "/bestvideo[ext=mp4]+bestaudio"
                "/best"
            ),
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"],
                }
            },
        }

    else:
        # Generic fallback — works for Twitter/X and most other sites
        platform_opts = {
            "format": (
                "best[ext=mp4][height<=720]"
                "/best[ext=mp4]"
                "/best[height<=720]"
                "/best"
            ),
        }

    ydl_opts = {**base_opts, **platform_opts}

    if progress_callback:
        progress_callback(f"Detected platform: {platform.title()} — optimizing download…")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            if progress_callback:
                progress_callback("Extracting video metadata and user comments…")
            info = ydl.extract_info(url, download=True)

            # ── Save metadata & comments to info.json ───────────────────────
            metadata = {
                "title": info.get("title", ""),
                "description": info.get("description", ""),
                "uploader": info.get("uploader", ""),
                "comments": []
            }
            raw_comments = info.get("comments") or []
            try:
                # Sort comments by like count descending to get the most valuable comments
                raw_comments = sorted(raw_comments, key=lambda c: c.get("like_count", 0) or 0, reverse=True)
            except Exception:
                pass

            for rc in raw_comments[:30]:
                metadata["comments"].append({
                    "author": rc.get("author", rc.get("author_id", "anonymous")),
                    "text": rc.get("text", ""),
                    "like_count": rc.get("like_count", 0) or 0
                })

            import json as _json
            with open(job_dir / "info.json", "w", encoding="utf-8") as f:
                _json.dump(metadata, f, ensure_ascii=False, indent=2)

            # ── Find the downloaded file ──────────────────────────────────
            # Primary: clip.mp4 (most common after merge_output_format=mp4)
            expected = job_dir / "clip.mp4"
            if expected.exists() and expected.stat().st_size > 1000:
                if progress_callback:
                    progress_callback(f"✅ {platform.title()} ready: {expected.stat().st_size // 1024} KB")
                return expected

            # Secondary: any video file in the job dir (catches webm, mkv etc.)
            for ext in ("mp4", "mkv", "webm", "mov", "avi"):
                candidates = sorted(
                    job_dir.glob(f"*.{ext}"),
                    key=lambda p: p.stat().st_size,
                    reverse=True,
                )
                for c in candidates:
                    if c.stat().st_size > 1000:
                        if progress_callback:
                            progress_callback(f"✅ Download complete: {c.name} ({c.stat().st_size // 1024} KB)")
                        return c

            raise RuntimeError("Download finished but no valid video file found.")

    except yt_dlp.utils.DownloadError as e:
        err = str(e).lower()
        if "private" in err:
            raise RuntimeError("private_video") from e
        if "not available" in err or "unavailable" in err:
            raise RuntimeError("video_unavailable") from e
        if "login" in err or "sign in" in err or "authentication" in err:
            raise RuntimeError("login_required") from e
        if "age" in err and ("restrict" in err or "verif" in err):
            raise RuntimeError("age_restricted") from e
        raise RuntimeError(f"Download failed: {e}") from e
    except Exception as e:
        raise RuntimeError(f"Video download failed: {e}") from e
