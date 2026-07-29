import os
import sys
from pathlib import Path

# Add project root to sys.path for direct script execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.src.video_processor import download_video
from backend.src.frame_extractor import extract_frames
from backend.src.transcriber import transcribe_video
from backend.src.gemini_analyzer import analyze_video
from backend.src.music_detector import detect_music_from_video

def main():
    print("=== Pipeline Diagnostic Test ===")
    
    # 1. Video Path
    video_path = Path("backend/temp/test_dl_001/clip.mp4")
    if not video_path.exists():
        print("Video not found. Downloading first...")
        video_path = download_video("https://www.youtube.com/shorts/dQw4w9WgXcQ", "test_dl_001")
        print(f"Downloaded to: {video_path}")
    else:
        print(f"Using existing video: {video_path}")
        
    job_id = "test_dl_001"
    
    # 2. Extract Frames
    print("\n--- Running Frame Extraction ---")
    frames = extract_frames(video_path, job_id, progress_callback=print)
    print(f"Extracted {len(frames)} frames.")
    
    # 3. Audio Transcription
    print("\n--- Running Transcription ---")
    transcript_data = transcribe_video(video_path, job_id, progress_callback=print)
    print(f"Transcribed {transcript_data.get('word_count')} words.")
    print("Full text preview:", transcript_data.get("full_text")[:200])
    
    # 4. Gemini Vision Analysis
    print("\n--- Running Gemini Analysis ---")
    # Verify api key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY not found in environment!")
    else:
        print("GEMINI_API_KEY is present.")
        
    mock_metadata = {
        "title": "Never Gonna Give You Up (Speed up / slowed phonk remix)",
        "description": "Rickroll but it's a phonk style beat. Credits to Rick Astley.",
        "uploader": "MemeLord",
        "comments": [
            {
                "author": "MemeWatcher",
                "text": "What is the phonk song in the background? It sounds like Metamorphosis by Interworld but slowed?",
                "like_count": 140
            },
            {
                "author": "MusicHelper",
                "text": "It's Interworld - Metamorphosis (Slowed & Reverb Version)",
                "like_count": 95
            },
            {
                "author": "AstleyFan",
                "text": "This movie scene is from Rick Astley's official music video!",
                "like_count": 50
            }
        ]
    }
    analysis = analyze_video(frames, transcript_data, transcript_data.get("duration", 0.0), progress_callback=print, metadata=mock_metadata)
    print("\n--- Running Music Detection Diagnostic ---")
    music_res = detect_music_from_video(video_path, progress_callback=print)
    print("Music Detection Result:", music_res)

    print("\nAnalysis Result:")
    import json
    print(json.dumps(analysis, indent=2))

if __name__ == "__main__":
    main()
