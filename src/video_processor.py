import os
import re
import yt_dlp
from pathlib import Path
from src.config import TEMP_DIR, MAX_VIDEO_SIZE_MB

def is_valid_url(url: str) -> bool:
    """Verifies if the string is a valid web URL."""
    url_pattern = re.compile(
        r'^(?:http|ftp)s?://' # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|' # domain...
        r'localhost|' # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})' # ...or ip
        r'(?::\d+)?' # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    return re.match(url_pattern, url) is not None

def download_video(url: str) -> str:
    """
    Downloads a short-form video from URLs (Instagram Reels, YouTube Shorts, etc.)
    using yt-dlp. Saves inside TEMP_DIR and returns the local absolute path.
    """
    if not is_valid_url(url):
        raise ValueError(f"Invalid URL provided: {url}")

    # Set up download options
    # We prefer mp4 container, capped size, quiet output
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': str(TEMP_DIR / 'downloaded_clip_%(id)s.%(ext)s'),
        'merge_output_format': 'mp4',
        'max_filesize': MAX_VIDEO_SIZE_MB * 1024 * 1024,
        'quiet': True,
        'no_warnings': True,
        # Emulate standard browser client to avoid rate limits
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # First extract video metadata without download
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            # Since yt-dlp might merge audio/video and change extension (e.g. from mkv to mp4),
            # let's verify if the file exists under alternative extensions.
            base, ext = os.path.splitext(filename)
            if not os.path.exists(filename):
                for candidate_ext in ['.mp4', '.mkv', '.webm']:
                    candidate_file = f"{base}{candidate_ext}"
                    if os.path.exists(candidate_file):
                        filename = candidate_file
                        break
            
            if os.path.exists(filename):
                return os.path.abspath(filename)
            else:
                # Scrape directory for latest modified file matching template
                files = list(TEMP_DIR.glob("downloaded_clip_*"))
                if files:
                    latest_file = max(files, key=os.path.getmtime)
                    return str(latest_file.resolve())
                raise FileNotFoundError("Video download succeeded but output file could not be located.")
                
    except Exception as e:
        raise RuntimeError(f"Error fetching URL content: {str(e)}")

def extract_keyframes(video_path: str, timestamps: list = None) -> list:
    """
    Placeholder for Phase 2: Frame Extraction.
    Will extract keyframes from local video and return list of file paths.
    """
    # Stub returning empty list
    return []

def extract_audio(video_path: str) -> str:
    """
    Placeholder for Phase 3: Audio Extraction.
    Will extract audio track from video and save as a WAV file.
    """
    # Stub returning empty string
    return ""
