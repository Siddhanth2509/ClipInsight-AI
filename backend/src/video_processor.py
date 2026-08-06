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
import time
import random
import functools
from pathlib import Path
from backend.src.config import TEMP_DIR, MAX_VIDEO_SIZE_MB


def retry_with_exponential_backoff(max_retries: int = 3, base_delay: float = 1.0, max_delay: float = 10.0):
    """Decorator applying exponential backoff with full jitter for network resilience."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while True:
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    retries += 1
                    if retries > max_retries:
                        raise e
                    sleep_time = min(max_delay, base_delay * (2 ** (retries - 1)))
                    jittered_sleep = random.uniform(0, sleep_time)
                    time.sleep(jittered_sleep)
        return wrapper
    return decorator


def is_valid_url(url: str) -> bool:
    """
    Validates the structure of a given URL.
    - Protocol: Supports http, https, ftp, ftps
    - Host: Supports domain names, localhost, or IPv4 addresses
    - Optional: Custom port, path query, and fragment strings
    """
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
    if "instagram.com" in u or "instagr.am" in u:
        return "instagram"
    if "tiktok.com" in u or "vt.tiktok.com" in u or "vm.tiktok.com" in u:
        return "tiktok"
    if "youtube.com" in u or "youtu.be" in u:
        return "youtube"
    if "twitter.com" in u or "x.com" in u:
        return "twitter"
    return "generic"


def parse_tiktok_video_id(url: str) -> str:
    """Extract TikTok video numeric ID from standard or short URLs."""
    match = re.search(r"(?:video/|v/|embed/|/photo/)(\d{15,22})", url)
    return match.group(1) if match else ""


def detect_frame_blur(frame_path: Path | str, threshold: float = 100.0) -> bool:
    """Compute Laplacian variance of a image frame to detect motion blur."""
    import cv2
    img = cv2.imread(str(frame_path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        return True
    variance = cv2.Laplacian(img, cv2.CV_64F).var()
    return variance < threshold


def get_video_aspect_ratio(video_path: Path | str) -> dict:
    """
    Reads video resolution and computes aspect ratio metadata.
    Returns: {"width": int, "height": int, "aspect_ratio": str, "is_vertical": bool}
    """
    import cv2
    path = str(video_path)
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return {"width": 0, "height": 0, "aspect_ratio": "Unknown", "is_vertical": False}

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    if width <= 0 or height <= 0:
        return {"width": 0, "height": 0, "aspect_ratio": "Unknown", "is_vertical": False}

    is_vertical = height > width
    ratio_str = f"{width}:{height}"
    if abs((width / height) - (9 / 16)) < 0.05:
        ratio_str = "9:16 (Vertical Reel/Short)"
    elif abs((width / height) - (16 / 9)) < 0.05:
        ratio_str = "16:9 (Widescreen)"
    elif abs((width / height) - 1.0) < 0.05:
        ratio_str = "1:1 (Square)"

    return {
        "width": width,
        "height": height,
        "aspect_ratio": ratio_str,
        "is_vertical": is_vertical
    }


def save_uploaded_file(file_bytes: bytes, filename: str, job_id: str) -> Path:
    """Saves an uploaded video file to a job-specific temp folder."""
    job_dir = TEMP_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    dest = job_dir / filename
    dest.write_bytes(file_bytes)
    return dest


def cookies_contain_domain(cookie_file_path: Path, domain_keyword: str) -> bool:
    """Check if a cookies file contains entries matching a specific domain keyword."""
    try:
        if not cookie_file_path.exists():
            return False
        content = cookie_file_path.read_text(encoding="utf-8", errors="ignore")
        matched = domain_keyword.lower() in content.lower()
        print(f"│ Cookies validation: '{cookie_file_path.name}' contains '{domain_keyword}' -> {matched}")
        return matched
    except Exception as e:
        print(f"│ Cookies validation error: {e}")
        return False


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
        "getcomments":                   False,  # Extracted separately post-download for speed
        "max_comments":                  0,      # Must be 0 when getcomments=False
        # 📚 Bypass Anti-Scraping blocks:
        #   Many platforms (like YouTube/TikTok) block requests that don't match typical browser headers.
        #   Using a modern User-Agent and Accept-Language header avoids immediate bot detection.
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
        # Let yt-dlp use its default client sequence for maximum compatibility.
        # SINGLE-STREAM preferred to avoid [Errno 22] on merge temp files.
        platform_opts = {
            "format": (
                "best[ext=mp4][height<=720]"                             # Combined stream (no merge)
                "/best[ext=mp4]"                                         # Any combined MP4
                "/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]"   # DASH fallback
                "/bestvideo[ext=mp4]+bestaudio"
                "/best"
            ),
            "extractor_args": {
                "youtube": {
                    "max_comments": ["30", "30", "0", "0"],
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

    # Auto-load any cookies.txt or cookies1.txt if present in root or backend folder
    root_dir = Path(__file__).parent.parent.parent
    backend_dir = Path(__file__).parent.parent
    
    candidate_cookies = []
    for d in (root_dir, backend_dir):
        if d.exists():
            for f in d.glob("cookies*"):
                if f.is_file() and f.name.lower().endswith((".txt", "")):
                    candidate_cookies.append(f)
                    
    if candidate_cookies:
        # Sort to prefer files that have more content (larger size)
        candidate_cookies.sort(key=lambda p: p.stat().st_size, reverse=True)
        
        # Select the first cookies file that actually contains cookies for this platform
        selected_cookie_file = None
        # For youtube, look for 'youtube' or 'google'; for instagram, look for 'instagram'
        domain_keywords = ["instagram"] if platform == "instagram" else ["youtube", "google"] if platform == "youtube" else [platform]
        
        for f in candidate_cookies:
            if any(cookies_contain_domain(f, kw) for kw in domain_keywords):
                selected_cookie_file = f
                break
                
        if selected_cookie_file:
            ydl_opts["cookiefile"] = str(selected_cookie_file)
            if progress_callback:
                progress_callback(f"Loading cookies from {selected_cookie_file.name} for {platform}…")
        else:
            if progress_callback:
                progress_callback(f"No cookies found for {platform} in cookies files. Proceeding anonymously…")

    if progress_callback:
        progress_callback(f"Detected platform: {platform.title()} — optimizing download…")

    try:
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                if progress_callback:
                    progress_callback("Extracting video metadata and user comments…")
                info = ydl.extract_info(url, download=True)
        except Exception as first_err:
            # Check if cookies were loaded. If so, retry anonymously (without cookies)
            if "cookiefile" in ydl_opts:
                if progress_callback:
                    progress_callback("Download with cookies failed. Retrying anonymously…")
                # Clear directory to prevent HTTP 416 (Range Not Satisfiable) resume issues on retry
                try:
                    for f in job_dir.glob("*"):
                        if f.is_file():
                            f.unlink()
                except Exception:
                    pass
                # Make a copy of ydl_opts and delete 'cookiefile'
                retry_opts = ydl_opts.copy()
                retry_opts.pop("cookiefile", None)
                with yt_dlp.YoutubeDL(retry_opts) as ydl:
                    info = ydl.extract_info(url, download=True)
            else:
                raise first_err

            # Check duration limit (max 3 minutes / 180s)
        duration = info.get("duration", 0)
        if duration and duration > 180:
            # Clean up downloaded files in the job directory
            try:
                for f in job_dir.glob("*"):
                    if f.is_file():
                        f.unlink()
            except Exception:
                pass
            raise RuntimeError("video_too_long")

        # ── Save detailed metadata to info.json (comments fetched separately) ─
        metadata = {
            "title":       info.get("title", ""),
            "description": info.get("description", ""),
            "uploader":    info.get("uploader", info.get("channel", "")),
            "channel":     info.get("channel", info.get("uploader", "")),
            "view_count":  info.get("view_count", 0),
            "like_count":  info.get("like_count", 0),
            "upload_date": info.get("upload_date", ""),
            "thumbnail":   info.get("thumbnail", ""),
            "comments":    []   # Populated later by fetch_comments()
        }
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
    except RuntimeError as e:
        raise e
    except Exception as e:
        raise RuntimeError(f"Video download failed: {e}") from e


def fetch_comments(url: str, job_id: str, max_comments: int = 20, progress_callback=None) -> list:
    """
    Fetch top comments for a URL as a NON-BLOCKING background step.
    Designed to run in parallel with frame extraction.

    Uses a separate yt-dlp call with skip_download=True (fast — no video bytes).
    Updates info.json in the job directory when done.

    Returns list of comment dicts, or [] on failure.
    """
    import json as _json

    platform  = detect_platform(url)
    job_dir   = TEMP_DIR / job_id
    info_path = job_dir / "info.json"

    # Only YouTube and TikTok have reliable comment APIs via yt-dlp
    if platform not in ("youtube", "tiktok"):
        return []

    if progress_callback:
        progress_callback("Fetching top comments for context…")

    # Hard timeout: comment fetching must not block the pipeline for more than 20 seconds.
    # yt-dlp's own socket_timeout covers individual HTTP calls; we also rely on
    # the asyncio thread executor timeout set in main.py (30s) as an outer guard.
    comment_opts = {
        "skip_download":  True,
        "getcomments":    True,
        "quiet":          True,
        "no_warnings":    True,
        "socket_timeout": 10,    # Per-request timeout (was 15)
        "retries":        1,     # Only 1 retry to keep it snappy
    }

    if platform == "youtube":
        comment_opts["extractor_args"] = {
            "youtube": {
                "player_client": ["android"],
                "max_comments":  [str(max_comments), str(max_comments), "0", "0"],
            }
        }

    try:
        with yt_dlp.YoutubeDL(comment_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        raw_comments = (info.get("comments") or []) if info else []
        raw_comments = sorted(
            raw_comments,
            key=lambda c: c.get("like_count", 0) or 0,
            reverse=True,
        )
        comments = [
            {
                "author":     rc.get("author", rc.get("author_id", "anonymous")),
                "text":       rc.get("text", ""),
                "like_count": rc.get("like_count", 0) or 0,
            }
            for rc in raw_comments[:max_comments]
        ]

        # Merge into existing info.json
        if info_path.exists() and comments:
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    existing = _json.load(f)
                existing["comments"] = comments
                with open(info_path, "w", encoding="utf-8") as f:
                    _json.dump(existing, f, ensure_ascii=False, indent=2)
            except Exception:
                pass

        if progress_callback:
            progress_callback(f"Got {len(comments)} comments for context")
        return comments

    except Exception as e:
        if progress_callback:
            progress_callback(f"Comments fetch skipped: {e}")
        return []
