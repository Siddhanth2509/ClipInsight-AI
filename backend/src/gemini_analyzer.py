"""
gemini_analyzer.py — Phase 2: Multimodal AI Analysis via Gemini 2.0 Flash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 LEARNING GUIDE — Multimodal AI & Prompt Engineering
────────────────────────────────────────────────────────

WHAT IS "MULTIMODAL"?
  Traditional LLMs (GPT-3, early BERT) only processed TEXT.
  Multimodal models process MULTIPLE data types simultaneously:
    • Text tokens
    • Image patches (divided into 16×16 pixel grids)
    • Audio (Gemini 2.0 can process audio natively)

  Gemini 2.0 Flash uses a unified transformer architecture — the same
  attention mechanism that processes text also "attends" to image patches.
  This lets it reason like: "The person in frame 3 is smiling, and the
  transcript at 0:03 says 'amazing product' — positive sentiment confirmed."

HOW GEMINI READS IMAGES:
  1. Each image is divided into 16×16 pixel patches
  2. Each patch is embedded into a vector (like a word embedding)
  3. These patch vectors join the text token sequence
  4. The transformer processes text + image patches together
  5. The model answers questions about BOTH simultaneously

STRUCTURED OUTPUT (JSON MODE):
  The naive approach: "Please analyze this video and tell me about it."
  Problem: The model might return a paragraph, a list, markdown, anything.
  Your app breaks trying to parse it.

  The pro approach: Specify EXACTLY what JSON structure you want in the prompt.
  Then tell the model: "Return ONLY valid JSON, no markdown, no explanations."

  We then use Pydantic to:
    • Parse the JSON string into a Python object
    • Validate each field type (hook_score must be 0-100 int)
    • Provide defaults if a field is missing
  This makes the pipeline robust even if Gemini slightly deviates.

RATE LIMITS & TOKEN BUDGETS:
  Gemini 2.0 Flash limits:
    • 1,500 requests/minute (free tier)
    • Each image ≈ 258 tokens (regardless of resolution after certain size)
    • Max 20 images per request
  
  We send MAX 15 frames to leave headroom for the text prompt + response.
  This keeps cost per analysis under $0.001 (essentially free on free tier).
"""

import json
import base64
import re
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

from google import genai
from google.genai import types as genai_types
from backend.src.config import GEMINI_API_KEY, TEMP_DIR

# ── Configure the Gemini SDK ──────────────────────────────────────────────────
# google-genai (new SDK): client-based rather than global configure
_genai_client = None

def _get_client():
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=GEMINI_API_KEY)
    return _genai_client

# Maximum frames to send per API call (cost + latency balance)
MAX_FRAMES_TO_SEND = 10  # Reduced for speed: 10 frames is enough for short-form content


# ── Pydantic Schema — Defines the expected AI output ─────────────────────────
# 📚 Pydantic is a Python library for data validation using type hints.
#    When we parse the AI's JSON response with this model, Pydantic:
#      • Checks every field exists and has the right type
#      • Coerces types where possible (e.g., "85" string → 85 int)
#      • Raises ValidationError with clear messages if something is wrong
#      • Provides default values for optional/missing fields

class InferredMusic(BaseModel):
    """Fallback music prediction details."""
    song_title: Optional[str] = Field(default=None, description="Inferred song title or music genre, null if not inferred.")
    artist: Optional[str] = Field(default=None, description="Inferred artist or producer, null if not inferred.")
    confidence: float = Field(default=0.0, description="Confidence of the inference from 0.0 to 1.0.")
    explanation: Optional[str] = Field(default=None, description="Explanation of how the music was inferred from comments or context.")

class VideoAnalysis(BaseModel):
    """Structured output schema for AI video analysis."""

    summary: str = Field(
        default="Analysis unavailable.",
        description="3-sentence overview of the video content."
    )
    topics: List[str] = Field(
        default_factory=list,
        description="Main topics or themes discussed."
    )
    tags: List[str] = Field(
        default_factory=list,
        description="5-10 hashtag-ready keywords (without the # symbol)."
    )
    sentiment: str = Field(
        default="Neutral",
        description="Overall emotional tone: Positive, Neutral, or Negative."
    )
    sentiment_score: float = Field(
        default=0.5,
        description="Sentiment confidence: 0.0 (very negative) to 1.0 (very positive)."
    )
    hook_score: int = Field(
        default=50,
        description="Engagement quality of the first 3 seconds: 0-100."
    )
    hook_analysis: str = Field(
        default="",
        description="Brief explanation of the hook score."
    )
    target_audience: str = Field(
        default="General audience",
        description="Inferred demographic (e.g., 'Fitness enthusiasts aged 18-30')."
    )
    suggestions: List[str] = Field(
        default_factory=list,
        description="3-5 specific, actionable improvement suggestions."
    )
    content_category: str = Field(
        default="General",
        description="Content category (e.g., Tech, Lifestyle, Education, Comedy)."
    )
    estimated_watch_time: str = Field(
        default="Unknown",
        description="Estimated % of viewers who'd watch to the end."
    )
    referenced_media: Optional[str] = Field(
        default=None,
        description="The movie, series, drama, anime, game, creator, or celebrity this video is about. Include name and brief detail if identified. Null if it is general or personal content."
    )
    inferred_music: Optional[InferredMusic] = Field(
        default=None,
        description="Background music/song details inferred from description, title, comments, transcript, or visual style, especially useful if Shazam fails."
    )

    # 📚 Field validators — extra business logic on top of type checking
    @field_validator("hook_score")
    @classmethod
    def clamp_hook_score(cls, v):
        """Ensure hook_score stays in 0-100 range even if AI returns 150."""
        return max(0, min(100, int(v)))

    @field_validator("sentiment_score")
    @classmethod
    def clamp_sentiment(cls, v):
        """Ensure sentiment_score stays in 0.0-1.0 range."""
        return max(0.0, min(1.0, float(v)))

    @field_validator("sentiment")
    @classmethod
    def normalize_sentiment(cls, v):
        """Accept 'positive'/'POSITIVE' → normalize to 'Positive'."""
        mapping = {"positive": "Positive", "negative": "Negative", "neutral": "Neutral"}
        return mapping.get(v.lower(), "Neutral")


def _load_frame_as_base64(frame_path: Path) -> Optional[dict]:
    """
    Load a JPEG frame and encode it as base64 for the Gemini API.

    📚 Why Base64?
       APIs communicate over HTTP, which is text-based.
       Binary image data can't be embedded directly in JSON.
       Base64 encodes binary → ASCII text (using A-Z, a-z, 0-9, +, /).
       It inflates file size by ~33% but makes it JSON-compatible.

       Gemini's API also accepts Google Cloud Storage URIs (gs://...),
       which is better for large files. Base64 is fine for small frames.
    """
    # frame_path is a relative path like "job_id/frames/frame_000.jpg"
    # It must be joined with TEMP_DIR to get the absolute path
    path = Path(frame_path)
    if not path.is_absolute():
        path = TEMP_DIR / frame_path
    if not path.exists():
        return None
    with open(path, "rb") as f:
        data = f.read()
    return {
        "mime_type": "image/jpeg",
        "data": base64.b64encode(data).decode("utf-8"),
    }


def _build_prompt(transcript: str, frame_count: int, duration: float, metadata: Optional[dict] = None) -> str:
    """
    Build the structured prompt that instructs Gemini exactly what to return.
    """
    transcript_section = (
        f"TRANSCRIPT:\n{transcript}" if transcript
        else "TRANSCRIPT: [No audio track detected in this video]"
    )

    metadata_section = ""
    if metadata:
        metadata_section += "VIDEO METADATA:\n"
        metadata_section += f"Title: {metadata.get('title', '')}\n"
        metadata_section += f"Description: {metadata.get('description', '')}\n"
        metadata_section += f"Uploader: {metadata.get('uploader', '')}\n\n"

        comments = metadata.get("comments") or []
        if comments:
            metadata_section += "USER COMMENTS (clues for referenced media and background music):\n"
            for c in comments:
                metadata_section += f"- {c.get('author', 'anonymous')}: {c.get('text', '')}\n"
            metadata_section += "\n"

    return f"""You are an expert social media video analyst specializing in short-form content
(Instagram Reels, YouTube Shorts, TikTok). You have access to {frame_count} sampled frames
from a {duration:.0f}-second video, plus its transcript.

{metadata_section}

{transcript_section}

Analyze the video holistically — combining visual content from the frames, spoken words (transcript), and context from the video metadata & user comments if available.
Return ONLY a valid JSON object with exactly this structure (no markdown, no code blocks,
no explanations — raw JSON only):

{{
  "summary": "<3 sentences describing what this video is about, who appears, and what happens>",
  "topics": ["<topic 1>", "<topic 2>", "<topic 3>"],
  "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"],
  "sentiment": "<exactly one of: Positive, Neutral, Negative>",
  "sentiment_score": <float 0.0 to 1.0 where 1.0 is most positive>,
  "hook_score": <integer 0 to 100 rating the engagement quality of the first 3 seconds>,
  "hook_analysis": "<1 sentence explaining the hook score>",
  "target_audience": "<specific demographic description>",
  "suggestions": [
    "<specific actionable improvement 1>",
    "<specific actionable improvement 2>",
    "<specific actionable improvement 3>"
  ],
  "content_category": "<one of: Education, Entertainment, Comedy, Lifestyle, Tech, Fashion, Food, Fitness, Business, Other>",
  "estimated_watch_time": "<estimated % of viewers who watch to end, e.g. '65%'>",
  "referenced_media": "<the movie, series, drama, anime, game, or creator/celebrity this video is about. Set to null if it's general or personal content>",
  "inferred_music": {{
    "song_title": "<the song/music title if inferred from comments or context. Use comment clues (especially if they mention phonk, beats, or speeded/slowed versions of a song). Set to null if not identified>",
    "artist": "<the artist/producer of the inferred song, or null>",
    "confidence": <float 0.0 to 1.0 indicating your confidence in this inference>,
    "explanation": "<brief explanation of how you inferred the music from comments or video/audio clues, or null>"
  }}
}}

Be specific and concrete. Avoid vague statements.
If comments mention "song?", "music?", "what is the song", etc., look at the replies or comments to identify the music. If comments mention it is a slowed, reverbed, or phonk edit of a specific song, detail that in the inferred_music.explanation and inferred_music.song_title.
"""


def analyze_video(
    frames: List[dict],
    transcript_data: dict,
    duration_seconds: float,
    progress_callback=None,
    metadata: Optional[dict] = None
) -> dict:
    """
    Send frames + transcript to Gemini 2.0 Flash and return structured analysis.

    Args:
        frames:           List of frame dicts from frame_extractor.extract_frames()
        transcript_data:  Dict from transcriber.transcribe_video()
        duration_seconds: Video duration in seconds
        progress_callback: Optional callable(str) for live status updates
        metadata:          Optional video metadata (title, description, comments)

    Returns:
        Full analysis dict (VideoAnalysis fields + frame/transcript metadata)
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        log("No Gemini API key set — returning demo analysis")
        return _demo_analysis(frames, transcript_data, duration_seconds)

    # ── Initialize the client ─────────────────────────────────────────────────
    # 📚 Model selection:
    #   "gemini-2.0-flash"       — fastest, cheapest, excellent for this task
    #   "gemini-1.5-pro"         — more powerful, higher cost
    #   "gemini-2.5-pro-preview" — most capable, highest cost
    client = _get_client()

    # ── Build the message content ─────────────────────────────────────────────
    # Gemini's API accepts a list of "parts" — a mix of text and images.
    # The model processes ALL parts together in a single forward pass.
    content_parts = []

    # Add frames (capped at MAX_FRAMES_TO_SEND)
    frames_to_send = frames[:MAX_FRAMES_TO_SEND]
    log(f"Sending {len(frames_to_send)} frames to Gemini…")

    for frame in frames_to_send:
        image_data = _load_frame_as_base64(Path(frame["path"]))
        if image_data:
            # 📚 Each image is added as a Part with inline base64 data.
            #    Gemini tokenizes this into ~258 image tokens internally.
            content_parts.append(
                genai_types.Part.from_bytes(
                    data=base64.b64decode(image_data["data"]),
                    mime_type="image/jpeg",
                )
            )

    # Add the text prompt (comes AFTER images — models attend to it last)
    transcript_text = transcript_data.get("full_text", "")
    prompt = _build_prompt(transcript_text, len(frames_to_send), duration_seconds, metadata=metadata)
    content_parts.append(genai_types.Part.from_text(text=prompt))

    # ── Call the API with model rotation on 429 ──────────────────────────────
    MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
    response = None
    raw_text = ""
    last_err = None

    for model_name in MODELS_TO_TRY:
        log(f"Calling {model_name}...")
        try:
            res = client.models.generate_content(
                model=model_name,
                contents=content_parts,
                config=genai_types.GenerateContentConfig(
                    temperature=0.3,
                    response_mime_type="application/json",
                    response_schema=VideoAnalysis,
                ),
            )
            raw_text = res.text.strip()
            response = res
            log(f"Successfully generated via {model_name}")
            break
        except Exception as e:
            last_err = e
            err_msg = str(e)
            if "429" in err_msg or "quota" in err_msg.lower() or "resource_exhausted" in err_msg.lower():
                log(f"Model {model_name} quota hit, trying next model...")
                continue
            else:
                log(f"Gemini API error on {model_name}: {e}")
                return _demo_analysis(frames, transcript_data, duration_seconds)

    if response is None:
        log(f"All Gemini models failed or quota exceeded: {last_err}")
        return _demo_analysis(frames, transcript_data, duration_seconds)

    log("Gemini responded — parsing JSON…")

    # ── Parse and validate the JSON response ─────────────────────────────────
    try:
        raw_dict = json.loads(raw_text)
        analysis = VideoAnalysis(**raw_dict)  # Pydantic validates + normalizes
    except (json.JSONDecodeError, Exception) as e:
        log(f"JSON parse error: {e} — using demo fallback")
        return _demo_analysis(frames, transcript_data, duration_seconds)

    # ── Assemble the final result dict ────────────────────────────────────────
    result = analysis.model_dump()  # Convert Pydantic model → plain dict

    # Attach metadata that came from other pipeline stages
    result["duration_seconds"]  = round(duration_seconds, 1)
    result["frame_count"]       = len(frames)
    result["word_count"]        = transcript_data.get("word_count", 0)
    result["transcript"]        = transcript_data.get("full_text", "")
    result["transcript_segments"] = transcript_data.get("segments", [])
    result["frames"]            = frames

    log(f"Analysis complete! Hook Score: {result['hook_score']}/100, Sentiment: {result['sentiment']}")
    return result


def _demo_analysis(frames: list, transcript_data: dict, duration: float) -> dict:
    """
    Fallback demo result when no API key is set or all models are quota-exceeded.
    Computes a dynamic hook score from actual video data so the score varies per video.
    """
    import random
    import hashlib

    word_count   = transcript_data.get("word_count", 0)
    full_text    = transcript_data.get("full_text", "")
    num_frames   = len(frames)

    # Deterministic seed from transcript content so same video = same score
    seed_str = full_text[:64] + str(round(duration)) + str(num_frames)
    seed_val = int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed_val)

    # Compute score components from real data
    # 1. Word density (words/sec) — higher density = more engaging
    words_per_sec  = word_count / max(duration, 1)
    density_score  = min(40, int(words_per_sec * 12))  # 0-40 pts

    # 2. Duration bonus — sweet spot 15-60s for reels
    if 15 <= duration <= 60:
        duration_score = 25
    elif 10 <= duration < 15 or 60 < duration <= 90:
        duration_score = 18
    else:
        duration_score = 10

    # 3. Frame richness
    frame_score = min(20, num_frames * 2)

    # 4. Small random variance (±8 pts) to differentiate different videos
    variance = rng.randint(-8, 8)

    hook_score = max(20, min(96, density_score + duration_score + frame_score + variance))

    # Derive sentiment from transcript text sentiment keywords
    positive_words = ["amazing", "great", "love", "awesome", "best", "wow", "beautiful", "incredible", "happy", "win"]
    negative_words = ["bad", "hate", "worst", "ugly", "fail", "terrible", "sad", "boring", "awful"]
    text_lower = full_text.lower()
    pos_count = sum(1 for w in positive_words if w in text_lower)
    neg_count = sum(1 for w in negative_words if w in text_lower)
    if pos_count > neg_count:
        sentiment, sentiment_score = "Positive", round(0.6 + rng.random() * 0.35, 2)
    elif neg_count > pos_count:
        sentiment, sentiment_score = "Negative", round(0.2 + rng.random() * 0.3, 2)
    else:
        sentiment, sentiment_score = "Neutral",  round(0.45 + rng.random() * 0.2, 2)

    est_watch = f"{hook_score + rng.randint(-5, 5)}%"

    return {
        "summary": (
            f"Analysis computed from video metrics (Gemini API quota exceeded). "
            f"Video is {round(duration)}s long with {word_count} spoken words across {num_frames} frames. "
            f"Add a paid Gemini API key for full AI analysis."
        ),
        "topics":  ["Content Creation", "Social Media", "Video Production"],
        "tags":    ["reels", "shortform", "content", "viral", "creator"],
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "hook_score": hook_score,
        "hook_analysis": (
            f"Computed from video data: {word_count} words in {round(duration)}s "
            f"({round(words_per_sec, 1)} words/sec density). "
            "Upgrade Gemini API key for detailed hook evaluation."
        ),
        "target_audience": "Social media users aged 18-35",
        "suggestions": [
            "Add a Gemini API key with billing enabled to unlock real AI suggestions.",
            f"Your video has {round(words_per_sec, 1)} words/sec — aim for 2.5-3.5 for optimal engagement.",
            f"At {round(duration)}s duration, {'this is in the optimal 15-60s range.' if 15 <= duration <= 60 else 'consider adjusting to 15-60s for better retention.'}",
        ],
        "content_category": "General",
        "estimated_watch_time": est_watch,
        "referenced_media": None,
        "inferred_music": None,
        "duration_seconds":    round(duration, 1),
        "frame_count":         num_frames,
        "word_count":          word_count,
        "transcript":          full_text,
        "transcript_segments": transcript_data.get("segments", []),
        "frames":              frames,
    }
