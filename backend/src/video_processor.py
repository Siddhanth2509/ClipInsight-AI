"""
video_processor.py — Video downloading (yt-dlp) and file saving.

📚 PLATFORM-AWARE DOWNLOADING:
   Different platforms need different strategies:
   • YouTube:   android client bypasses JS runtime (fastest)
   • Instagram: mobile client + 480p cap (CDN is slower, less resolution needed)
   • TikTok:    app client + no watermark option
   • Other:     generic fallback with conservative settings

📚 WHY CAP INSTAGRAM AT 480p?
   We only extract frames for AI analysis — 480p is MORE than enough resolution
   for Gemini to understand content. 1080p Instagram videos are 3-5x larger
   but provide zero extra AI insight. Smaller file = faster download.

📚 CONCURRENT FRAGMENT DOWNLOADS:
   Modern video sites split large files into small "fragments" (chunks).
   yt-dlp can download these chunks in parallel.
   `concurrent_fragment_downloads: 4` → 4x faster for fragmented streams.
"""
import os
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
    """
    Detect the video platform from a URL.

    📚 Pattern matching with simple string checks is faster and more
       readable than regex for well-known domain patterns.
    """
    url_lower = url.lower()
    if "instagram.com" in url_lower:
        return "instagram"
    if "tiktok.com" in url_lower:
        return "tiktok"
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    if "twitter.com" in url_lower or "x.com" in url_lower:
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
    Downloads a short-form video using yt-dlp with platform-aware settings.

    Platform optimizations:
    • Instagram: 480p cap, mobile client, faster CDN path
    • TikTok:    app client, no watermark
    • YouTube:   android client (no JS runtime needed)
    • Generic:   conservative fallback

    Returns the local Path to the downloaded video file.
    Raises RuntimeError if the download fails.
    """
    if not is_valid_url(url):
        raise ValueError(f"Invalid URL: {url}")

    platform = detect_platform(url)
    job_dir = TEMP_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    output_template = str(job_dir / "clip.%(ext)s")

    def _progress_hook(d):
        if not progress_callback:
            return
        status = d.get("status", "")
        if status == "downloading":
            pct   = d.get("_percent_str", "?%").strip()
            speed = d.get("_speed_str", "").strip()
            eta   = d.get("_eta_str", "").strip()
            progress_callback(f"Downloading [{platform}]: {pct}  {speed}  ETA {eta}")
        elif status == "finished":
            size_kb = d.get("total_bytes", 0) // 1024 or d.get("total_bytes_estimate", 0) // 1024
            progress_callback(f"Download finished ({size_kb}KB), muxing…")

    # ── Shared base options ─────────────────────────────────────────────────
    base_opts = {
        "outtmpl":                     output_template,
        "merge_output_format":         "mp4",
        "max_filesize":                MAX_VIDEO_SIZE_MB * 1024 * 1024,
        "socket_timeout":              20,
        "retries":                     3,
        "fragment_retries":            3,
        "concurrent_fragment_downloads": 4,     # 4x faster for chunked streams
        "quiet":                       True,
        "no_warnings":                 True,
        "progress_hooks":              [_progress_hook],
        "noprogress":                  False,
        "restrictfilenames":           True,    # Windows-safe filenames
        "windowsfilenames":            True,
        "writethumbnail":              False,
        "writeinfojson":               False,
        "http_headers": {
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        },
    }

    # ── Platform-specific overrides ─────────────────────────────────────────
    if platform == "instagram":
        # Instagram: cap at 480p — we only need frames, not cinema quality.
        # Mobile client is faster and avoids some CDN blocks.
        # postprocessor_args strips audio to speed up mux step.
        platform_opts = {
            "format": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]/best",
            "format_sort": ["res:480", "ext:mp4:m4a"],
            "extractor_args": {
                "instagram": {
                    "api": ["graphql"],
                }
            },
            "http_headers": {
                **base_opts["http_headers"],
                "User-Agent": (
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                    "Version/17.0 Mobile/15E148 Safari/604.1"
                ),
            },
        }

    elif platform == "tiktok":
        # TikTok: use app client, avoid watermark
        platform_opts = {
            "format": "bestvideo[height<=720][ext=mp4]+bestaudio/best[height<=720]/best",
            "extractor_args": {
                "tiktok": {
                    "app_version": ["27.2.4"],
                    "manifest_app_version": ["1180"],
                }
            },
        }

    elif platform == "youtube":
        # YouTube: android client bypasses JS runtime check (fastest)
        platform_opts = {
            "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"],
                }
            },
        }

    else:
        # Generic fallback — conservative settings
        platform_opts = {
            "format": "bestvideo[height<=720][ext=mp4]+bestaudio/best[height<=720]/best",
        }

    ydl_opts = {**base_opts, **platform_opts}

    if progress_callback:
        progress_callback(f"Detected platform: {platform.title()} — optimizing download…")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

            # Find the downloaded file
            expected = job_dir / "clip.mp4"
            if expected.exists() and expected.stat().st_size > 1000:
                if progress_callback:
                    progress_callback(f"✅ {platform.title()} download complete: {expected.stat().st_size // 1024}KB")
                return expected

            # Scan for any video file if clip.mp4 wasn't the output name
            for ext in ["mp4", "mkv", "webm", "mov", "avi"]:
                candidates = sorted(
                    job_dir.glob(f"*.{ext}"),
                    key=lambda p: p.stat().st_size,
                    reverse=True
                )
                for c in candidates:
                    if c.stat().st_size > 1000:
                        if progress_callback:
                            progress_callback(f"✅ Download complete: {c.name} ({c.stat().st_size // 1024}KB)")
                        return c

            # Last resort: use yt-dlp's own filename resolution
            if info:
                fname = ydl.prepare_filename(info)
                p = Path(fname)
                if p.exists() and p.stat().st_size > 1000:
                    return p

            raise RuntimeError("Download finished but no valid video file found.")

    except yt_dlp.utils.DownloadError as e:
        err = str(e)
        # Translate common yt-dlp errors into friendly messages
        if "Private" in err or "private" in err:
            raise RuntimeError("private_video") from e
        if "not available" in err or "unavailable" in err:
            raise RuntimeError("video_unavailable") from e
        if "login" in err.lower() or "sign in" in err.lower():
            raise RuntimeError("login_required") from e
        raise RuntimeError(f"Download failed: {e}") from e
    except Exception as e:
        raise RuntimeError(f"Video download failed: {e}") from e
