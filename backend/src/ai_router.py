"""
ai_router.py — Multi-model AI Router for ClipInsight AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Routes tasks to the best available AI model:
  • Gemini 2.0 Flash  — vision tasks (frame analysis) — primary
  • Sakana Fugu       — text reasoning (enhancement, suggestions) — secondary
  • MiniMax           — text reasoning fallback/option
  • Z.ai GLM          — text fallback if others are unavailable

Design principle: use Gemini only for what requires vision (images).
Let Sakana/MiniMax/GLM handle pure-text reasoning tasks to:
  1. Reduce Gemini token consumption (stay within free tier)
  2. Parallelize text + vision work for lower latency
  3. Use each model for what it does best
"""

import json
from typing import Optional, Tuple
from openai import OpenAI

from backend.src.config import (
    SAKANA_API_KEY, SAKANA_BASE_URL,
    MINIMAX_API_KEY, MINIMAX_BASE_URL,
    ZAI_API_KEY, ZAI_BASE_URL,
    OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL,
)

# ── Lazy-load OpenAI-compatible clients ──────────────────────────────────────
_sakana_client:     Optional[OpenAI] = None
_minimax_client:    Optional[OpenAI] = None
_zai_client:        Optional[OpenAI] = None
_openrouter_client: Optional[OpenAI] = None


def _get_sakana() -> Optional[OpenAI]:
    """Return Sakana AI client (OpenAI-compatible), or None if key missing."""
    global _sakana_client
    if _sakana_client is None:
        if not SAKANA_API_KEY or SAKANA_API_KEY.startswith("your_") or SAKANA_API_KEY.startswith("PASTE_"):
            return None
        _sakana_client = OpenAI(api_key=SAKANA_API_KEY, base_url=SAKANA_BASE_URL)
    return _sakana_client


def _get_minimax() -> Optional[OpenAI]:
    """Return MiniMax AI client (OpenAI-compatible), or None if key missing."""
    global _minimax_client
    if _minimax_client is None:
        if not MINIMAX_API_KEY or MINIMAX_API_KEY.startswith("your_") or MINIMAX_API_KEY.startswith("PASTE_"):
            return None
        _minimax_client = OpenAI(api_key=MINIMAX_API_KEY, base_url=MINIMAX_BASE_URL)
    return _minimax_client


def _get_zai() -> Optional[OpenAI]:
    """Return Z.ai client (OpenAI-compatible), or None if key missing."""
    global _zai_client
    if _zai_client is None:
        if not ZAI_API_KEY or ZAI_API_KEY.startswith("your_") or ZAI_API_KEY.startswith("PASTE_"):
            return None
        _zai_client = OpenAI(api_key=ZAI_API_KEY, base_url=ZAI_BASE_URL)
    return _zai_client


def _get_openrouter() -> Optional[OpenAI]:
    """Return OpenRouter client (OpenAI-compatible), or None if key missing."""
    global _openrouter_client
    if _openrouter_client is None:
        if not OPENROUTER_API_KEY or OPENROUTER_API_KEY.startswith("your_") or OPENROUTER_API_KEY.startswith("PASTE_"):
            return None
        # OpenRouter expects custom extra headers (optional but recommended for identification).
        # We reuse the client instance to avoid socket leaks during high-frequency fallback rotations.
        _openrouter_client = OpenAI(
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": "https://github.com/Siddhanth2509/ClipInsight-AI",
                "X-Title": "ClipInsight AI"
            }
        )
    return _openrouter_client


def get_best_text_client() -> Tuple[Optional[OpenAI], str]:
    """
    Deprecated in favor of dynamic fallback in _execute_completion.
    Kept for backwards compatibility if needed.
    """
    client = _get_sakana()
    if client:
        print("│ Selected Text Client: Sakana (Fugu)")
        return client, "fugu"

    client = _get_minimax()
    if client:
        print("│ Selected Text Client: MiniMax")
        return client, "MiniMax-Text-01"

    client = _get_zai()
    if client:
        print("│ Selected Text Client: Z.ai (GLM)")
        return client, "glm-4-flash"

    client = _get_openrouter()
    if client:
        print(f"│ Selected Text Client: OpenRouter ({OPENROUTER_MODEL})")
        return client, OPENROUTER_MODEL

    print("│ Selected Text Client: None (No API key found)")
    return None, ""


def _execute_completion(
    prompt: str,
    temperature: float = 0.3,
    max_tokens: int = 500,
    response_json: bool = True,
    progress_callback=None
) -> Tuple[Optional[str], str]:
    """
    Executes a chat completion trying all configured clients in priority order:
      Sakana Fugu → MiniMax → Z.ai GLM
    If a client fails (e.g. 402 insufficient balance), it automatically
    logs the warning and falls back to the next available one.

    Returns:
        (response_content, working_model_name) or (None, "") if all fail.
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    # 1. Gather all candidates that have keys configured
    candidates = []

    sakana_client = _get_sakana()
    if sakana_client:
        candidates.append((sakana_client, "fugu", "Sakana Fugu"))

    minimax_client = _get_minimax()
    if minimax_client:
        candidates.append((minimax_client, "MiniMax-Text-01", "MiniMax"))

    zai_client = _get_zai()
    if zai_client:
        candidates.append((zai_client, "glm-4-flash", "Z.ai GLM"))

    openrouter_client = _get_openrouter()
    if openrouter_client:
        candidates.append((openrouter_client, OPENROUTER_MODEL, "OpenRouter"))

    if not candidates:
        log("No text AI providers are configured (Sakana, MiniMax, or Z.ai keys missing)")
        return None, ""

    # 2. Try each candidate in order
    for client, model, provider_name in candidates:
        log(f"Attempting completion with {provider_name} ({model})…")
        try:
            kwargs = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_json:
                kwargs["response_format"] = {"type": "json_object"}

            response = client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content
            if content:
                log(f"✓ Success with {provider_name} ({model})")
                return content, model
        except Exception as e:
            err_msg = str(e)
            log(f"⚠️ {provider_name} failed: {err_msg}. Trying next fallback…")
            
            # MiniMax specific model backup attempt if it wasn't a balance error
            if provider_name == "MiniMax" and "balance" not in err_msg.lower():
                try:
                    log("Attempting MiniMax with fallback model MiniMax-M3…")
                    kwargs["model"] = "MiniMax-M3"
                    response = client.chat.completions.create(**kwargs)
                    content = response.choices[0].message.content
                    if content:
                        log("✓ Success with MiniMax (MiniMax-M3)")
                        return content, "MiniMax-M3"
                except Exception as m3_err:
                    log(f"⚠️ MiniMax (MiniMax-M3) fallback also failed: {m3_err}")

    log("❌ All text AI completion attempts failed.")
    return None, ""


def enhance_analysis_with_text_ai(
    base_result: dict,
    transcript: str,
    metadata: Optional[dict] = None,
    progress_callback=None,
) -> dict:
    """
    Use Sakana Fugu, MiniMax, or Z.ai GLM to enhance the base Gemini analysis
    with deeper text reasoning:
      - More specific actionable suggestions
      - Refined hook analysis
      - Better target audience profiling

    This runs AFTER Gemini vision analysis so it can build on the visual
    understanding already extracted. It only uses text (no images), making
    it much cheaper and faster for these reasoning-heavy tasks.

    Args:
        base_result:       The raw result dict from gemini_analyzer.analyze_video()
        transcript:        Full video transcript text
        metadata:          Optional video metadata (title, description, comments)
        progress_callback: Optional callable(str) for live updates

    Returns:
        Enhanced result dict (modifies suggestions, hook_analysis, target_audience in place)
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    # Build a focused enhancement prompt — text only, no images
    comments_text = ""
    if metadata and metadata.get("comments"):
        top_comments = metadata["comments"][:10]
        comments_text = "\n".join(
            f"  - {c.get('author', 'user')}: {c.get('text', '')}"
            for c in top_comments
        )

    prompt = f"""You are a social media growth expert. A video has been analyzed and here are the initial findings:

INITIAL ANALYSIS:
- Summary: {base_result.get('summary', '')}
- Hook Score: {base_result.get('hook_score', 50)}/100
- Hook Analysis: {base_result.get('hook_analysis', '')}
- Content Category: {base_result.get('content_category', '')}
- Target Audience: {base_result.get('target_audience', '')}
- Sentiment: {base_result.get('sentiment', '')}
- Initial Suggestions: {json.dumps(base_result.get('suggestions', []))}

VIDEO TRANSCRIPT:
{transcript[:1500] if transcript else "[No speech detected]"}

{"TOP COMMENTS:\\n" + comments_text if comments_text else ""}

Based on this context, provide ENHANCED, HYPER-SPECIFIC suggestions and improvements.
Return ONLY valid JSON with this exact structure:
{{
  "suggestions": [
    "<3-5 highly specific, actionable improvement with exact example or metric>",
    "<suggestion 2>",
    "<suggestion 3>"
  ],
  "hook_analysis": "<1-2 sentence precise analysis of what works/doesn't work in the first 3 seconds>",
  "target_audience": "<detailed demographic: platform + age + interest + pain point>"
}}

Be specific. Instead of "add better captions" say "Add bold white captions at the bottom third, 2 lines max, matching the speech rhythm to boost watch time by 15-20%."
"""

    raw_response, working_model = _execute_completion(
        prompt=prompt,
        temperature=0.4,
        max_tokens=600,
        response_json=True,
        progress_callback=progress_callback
    )

    if not raw_response:
        log("Text AI enhancement skipped — keeping original Gemini analysis")
        return base_result

    try:
        enhanced = json.loads(raw_response)

        # Only apply fields that returned valid data
        if enhanced.get("suggestions") and isinstance(enhanced["suggestions"], list):
            base_result["suggestions"] = enhanced["suggestions"]
            log(f"✓ Suggestions enhanced by {working_model}")

        if enhanced.get("hook_analysis"):
            base_result["hook_analysis"] = enhanced["hook_analysis"]

        if enhanced.get("target_audience"):
            base_result["target_audience"] = enhanced["target_audience"]

    except Exception as e:
        log(f"Text AI enhancement parsing failed: {e} — keeping original analysis")

    return base_result


def infer_music_with_text_ai(
    transcript: str,
    metadata: Optional[dict] = None,
    progress_callback=None,
) -> Optional[dict]:
    """
    Use Sakana/MiniMax/ZAI to infer background music from transcript and comments
    when Shazam fingerprinting fails. This is a pure text reasoning task —
    perfect for Fugu or MiniMax.

    Returns inferred_music dict or None.
    """
    def log(msg: str):
        if progress_callback:
            progress_callback(msg)

    comments_text = ""
    if metadata and metadata.get("comments"):
        comments_text = "\n".join(
            f"  - {c.get('author', 'user')}: {c.get('text', '')}"
            for c in metadata["comments"][:15]
        )

    if not transcript and not comments_text:
        return None

    prompt = f"""You are a music recognition expert for social media content.

A short video's audio could not be identified by Shazam fingerprinting (common for slowed, reverbed, or sped-up edits).

TRANSCRIPT:
{transcript[:800] if transcript else "[No speech]"}

{"VIEWER COMMENTS (often contain music clues):\\n" + comments_text if comments_text else ""}

Based on the transcript mood, any music mentions in comments, and common patterns in viral videos:
- Look for comments that mention song names, artists, or say "what song is this?"
- Look for comments with replies that name the song
- Infer from transcript mood/style (e.g., melancholic = likely lofi/phonk, hype = drill/trap)

Return ONLY valid JSON:
{{
  "song_title": "<inferred song title or null>",
  "artist": "<artist name or null>",
  "confidence": <0.0 to 1.0>,
  "explanation": "<brief explanation of the inference>"
}}

If you cannot make a reasonable inference, set song_title and artist to null and confidence to 0.0.
"""

    raw_response, working_model = _execute_completion(
        prompt=prompt,
        temperature=0.3,
        max_tokens=200,
        response_json=True,
        progress_callback=progress_callback
    )

    if not raw_response:
        return None

    try:
        result = json.loads(raw_response)
        if result.get("song_title"):
            log(f"✓ Music inferred by {working_model}: {result.get('song_title')}")
            return result
    except Exception as e:
        log(f"Music inference parsing failed: {e}")

    return None
