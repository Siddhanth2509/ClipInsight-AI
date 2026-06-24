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
MAX_FRAMES_TO_SEND = 15


# ── Pydantic Schema — Defines the expected AI output ─────────────────────────
# 📚 Pydantic is a Python library for data validation using type hints.
#    When we parse the AI's JSON response with this model, Pydantic:
#      • Checks every field exists and has the right type
#      • Coerces types where possible (e.g., "85" string → 85 int)
#      • Raises ValidationError with clear messages if something is wrong
#      • Provides default values for optional/missing fields

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
    path = TEMP_DIR / frame_path
    if not path.exists():
        return None
    with open(path, "rb") as f:
        data = f.read()
    return {
        "mime_type": "image/jpeg",
        "data": base64.b64encode(data).decode("utf-8"),
    }


def _build_prompt(transcript: str, frame_count: int, duration: float) -> str:
    """
    Build the structured prompt that instructs Gemini exactly what to return.

    📚 PROMPT ENGINEERING PRINCIPLES USED HERE:
       1. ROLE ASSIGNMENT: "You are an expert video analyst..."
          → Primes the model's response distribution toward expert language.

       2. CONTEXT FIRST: Give all the facts before asking questions.
          → Gemini reads the entire prompt before generating. Front-loading
            context leads to better-grounded responses.

       3. EXPLICIT FORMAT REQUIREMENT: "Return ONLY valid JSON..."
          → Reduces hallucination of markdown code blocks or prose.

       4. SCHEMA IN PROMPT: Paste the exact JSON structure you expect.
          → The model sees the schema and "patterns matches" it.

       5. FEW-SHOT CONSTRAINTS: "hook_score: integer 0-100"
          → Explicit constraints reduce out-of-range values.
    """
    transcript_section = (
        f"TRANSCRIPT:\n{transcript}" if transcript
        else "TRANSCRIPT: [No audio track detected in this video]"
    )

    return f"""You are an expert social media video analyst specializing in short-form content
(Instagram Reels, YouTube Shorts, TikTok). You have access to {frame_count} sampled frames
from a {duration:.0f}-second video, plus its transcript.

{transcript_section}

Analyze the video holistically — combining visual content from the frames AND the spoken words.
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
  "estimated_watch_time": "<estimated % of viewers who watch to end, e.g. '65%'>"
}}

Be specific and concrete. Avoid vague statements like "the video is engaging."
Instead say "The hook uses a question ('Did you know...') which increases curiosity gap."
"""


def analyze_video(
    frames: List[dict],
    transcript_data: dict,
    duration_seconds: float,
    progress_callback=None
) -> dict:
    """
    Send frames + transcript to Gemini 2.0 Flash and return structured analysis.

    Args:
        frames:           List of frame dicts from frame_extractor.extract_frames()
        transcript_data:  Dict from transcriber.transcribe_video()
        duration_seconds: Video duration in seconds
        progress_callback: Optional callable(str) for live status updates

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
    prompt = _build_prompt(transcript_text, len(frames_to_send), duration_seconds)
    content_parts.append(genai_types.Part.from_text(text=prompt))

    # ── Call the API ──────────────────────────────────────────────────────────
    log("Calling Gemini 3.1 Flash Lite API...")
    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=content_parts,
            config=genai_types.GenerateContentConfig(
                temperature=0.3,
                response_mime_type="application/json",
                response_schema=VideoAnalysis,
            ),
        )

        raw_text = response.text.strip()
        log("Gemini responded — parsing JSON…")

    except Exception as e:
        log(f"Gemini API error: {e}")
        return _demo_analysis(frames, transcript_data, duration_seconds)

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
    Fallback demo result when no API key is set.
    Lets you test the full frontend pipeline without spending API credits.

    📚 This is called a "graceful degradation" pattern — the app still
       works and shows the UI correctly even without a real API key.
       Useful for development, demos, and offline testing.
    """
    return {
        "summary": "This is a demo analysis. Add your GEMINI_API_KEY to the .env file to enable real AI analysis. The video appears to be a short-form content piece with engaging visuals.",
        "topics":  ["Content Creation", "Social Media", "Video Production"],
        "tags":    ["reels", "shortform", "content", "viral", "creator"],
        "sentiment": "Positive",
        "sentiment_score": 0.72,
        "hook_score": 68,
        "hook_analysis": "Demo mode: Add GEMINI_API_KEY for real hook analysis.",
        "target_audience": "Social media users aged 18-35",
        "suggestions": [
            "Add your GEMINI_API_KEY to .env to unlock real AI suggestions.",
            "Real analysis will evaluate hook strength, pacing, and CTA clarity.",
            "Whisper transcription is already working — add Gemini for full pipeline.",
        ],
        "content_category": "General",
        "estimated_watch_time": "~65%",
        "duration_seconds":  round(duration, 1),
        "frame_count":       len(frames),
        "word_count":        transcript_data.get("word_count", 0),
        "transcript":        transcript_data.get("full_text", ""),
        "transcript_segments": transcript_data.get("segments", []),
        "frames":            frames,
    }
