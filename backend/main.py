"""
main.py — FastAPI Backend for ClipInsight AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 LEARNING GUIDE — FastAPI & Async Architecture
──────────────────────────────────────────────────
FastAPI is a modern Python web framework built on:
  • Starlette  — the ASGI (async web server) foundation
  • Pydantic   — request/response validation
  • uvicorn    — the ASGI server that actually runs the code

WHY ASYNC?
  Python has the GIL (Global Interpreter Lock) — only one thread runs
  Python bytecode at a time. Normally this hurts multi-user performance.

  AsyncIO solves this differently: instead of threads, it uses coroutines.
  When we call `await asyncio.sleep(1)`, the event loop switches to handle
  another request WHILE we wait. No threads = no GIL contention.

  Key rule: `await` is only valid inside `async def` functions.
  CPU-bound work (like OpenCV, Whisper) must run in a thread pool
  via `asyncio.run_in_executor()` to avoid blocking the event loop.

API DESIGN — RESTful Conventions:
  POST /upload        → Accept + save file → return job_id
  POST /analyze-url   → Download from URL → return job_id
  POST /analyze/{id}  → Run full AI pipeline on existing job
  GET  /status/{id}   → Check job status
  GET  /results/{id}  → Fetch completed results
  GET  /stream/{id}   → Server-Sent Events (SSE) for live progress
  GET  /frame/{path}  → Serve extracted frame images

SERVER-SENT EVENTS (SSE):
  SSE is a one-way push protocol — the server pushes data to the browser
  continuously over a single HTTP connection. Unlike WebSockets, SSE is:
    • Simpler (just HTTP, auto-reconnects)
    • One-directional (server → client only)
    • Perfect for progress updates

  Format (each chunk):
    data: {"message": "Extracting frames...", "status": "extracting"}\n\n
  The double newline is the SSE spec's "end of message" delimiter.
"""

import uuid
import asyncio
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse, Response
from pydantic import BaseModel

class AnalyzeURLRequest(BaseModel):
    url: str

from backend.src.config import TEMP_DIR
from backend.src.video_processor  import save_uploaded_file, download_video, is_valid_url, fetch_comments
from backend.src.frame_extractor  import extract_frames
from backend.src.transcriber      import transcribe_video
from backend.src.gemini_analyzer  import analyze_video
from backend.src.music_detector   import detect_music_from_video
from backend.src.pdf_generator    import generate_pdf_report
from backend.src import ai_router

# ── App initialization ────────────────────────────────────────────────────────
app = FastAPI(
    title="ClipInsight AI",
    description="Multimodal AI video analysis API",
    version="2.0.0",
    docs_url="/docs",   # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc", # ReDoc at http://localhost:8000/redoc
)

# ── CORS Middleware ───────────────────────────────────────────────────────────
# 📚 CORS (Cross-Origin Resource Sharing):
#   Browsers block JS fetch() calls to a different domain/port by default.
#   Our Next.js app runs on localhost:3000, FastAPI on localhost:8000.
#   Different ports = different "origin" = browser blocks the request.
#   CORS middleware adds response headers telling the browser: "It's OK."
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],    # Allow GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],    # Allow all request headers
)

# ── In-memory stores ────────────────────────────────────────────────
jibs: dict[str, dict] = {}  # Avoid collision with 'jobs' type hint
jobs: dict[str, dict] = {}
share_tokens: dict[str, str] = {}  # token → job_id


def _new_job() -> str:
    """Create a new job entry and return its unique ID."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status":        "queued",
        "progress":      [],
        "result":        None,
        "error":         None,
        "video_path":    None,
        "thumbnail_url": None,   # Video thumbnail shown during analysis
        "source_url":    None,   # Original URL (for comment fetching)
    }
    return job_id


def _log(job_id: str, msg: str):
    """Append a progress message to a job (thread-safe for our use case)."""
    if job_id in jobs:
        jobs[job_id]["progress"].append(msg)
        print(f"[{job_id[:8]}] {msg}")  # Also log to console for debugging


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Simple health check endpoint. Used by load balancers and monitoring."""
    return {"status": "ok", "service": "ClipInsight AI", "version": "2.0.0"}


@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Accept a video file upload, save it, and return a job_id.

    📚 UploadFile is FastAPI's streaming file upload handler.
       `await file.read()` reads the entire file into memory.
       For very large files, you'd use `file.chunks()` to stream to disk.
    """
    ext = Path(file.filename or "upload").suffix.lower()
    if ext not in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    job_id     = _new_job()
    file_bytes = await file.read()

    video_path = save_uploaded_file(file_bytes, file.filename or "upload.mp4", job_id)
    jobs[job_id]["status"]     = "uploaded"
    jobs[job_id]["video_path"] = str(video_path)
    _log(job_id, f"Video uploaded: {file.filename} ({len(file_bytes) // 1024}KB)")

    return {"job_id": job_id, "filename": file.filename, "size_bytes": len(file_bytes)}


@app.post("/analyze-url")
async def analyze_url(url: str = Form(...)):
    """
    Accept a video URL, download it via yt-dlp, and return a job_id.
    Also extracts the thumbnail URL for display during analysis.
    """
    if not is_valid_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL.")

    job_id = _new_job()
    jobs[job_id]["status"]     = "downloading"
    jobs[job_id]["source_url"] = url   # Store for parallel comment fetching
    _log(job_id, f"Starting download: {url[:60]}…")

    loop = asyncio.get_event_loop()

    def _download():
        return download_video(url, job_id, progress_callback=lambda m: _log(job_id, m))

    try:
        video_path = await loop.run_in_executor(None, _download)
        jobs[job_id]["status"]     = "downloaded"
        jobs[job_id]["video_path"] = str(video_path)

        # Extract YouTube thumbnail (works without extra API calls)
        # Pattern: https://img.youtube.com/vi/{video_id}/maxresdefault.jpg
        import re as _re
        yt_match = _re.search(r"(?:v=|shorts/|youtu\.be/)([\w-]{11})", url)
        if yt_match:
            vid_id = yt_match.group(1)
            jobs[job_id]["thumbnail_url"] = f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"

        # Fallback to info.json thumbnail if YouTube regex doesn't match
        if not jobs[job_id].get("thumbnail_url") and video_path:
            info_path = video_path.parent / "info.json"
            if info_path.exists():
                import json as _json
                try:
                    with open(info_path, "r", encoding="utf-8") as f:
                        meta = _json.load(f)
                        if meta.get("thumbnail"):
                            jobs[job_id]["thumbnail_url"] = meta["thumbnail"]
                except Exception as e:
                    print(f"[WARN] Failed to read thumbnail from info.json: {e}")

        _log(job_id, "Download complete.")
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"]  = str(e)
        raise HTTPException(status_code=500, detail=str(e))

    return {"job_id": job_id}


@app.post("/analyze/url")
async def analyze_url_json(req: AnalyzeURLRequest):
    """
    Accept a video URL as JSON payload, download it, and return a job_id.
    """
    url = req.url
    if not is_valid_url(url):
        raise HTTPException(status_code=400, detail="Invalid URL.")

    job_id = _new_job()
    jobs[job_id]["status"]     = "downloading"
    jobs[job_id]["source_url"] = url
    _log(job_id, f"Starting download (JSON): {url[:60]}…")

    loop = asyncio.get_event_loop()

    def _download():
        return download_video(url, job_id, progress_callback=lambda m: _log(job_id, m))

    try:
        video_path = await loop.run_in_executor(None, _download)
        jobs[job_id]["status"]     = "downloaded"
        jobs[job_id]["video_path"] = str(video_path)

        # Extract YouTube thumbnail
        import re as _re
        yt_match = _re.search(r"(?:v=|shorts/|youtu\.be/)([\w-]{11})", url)
        if yt_match:
            vid_id = yt_match.group(1)
            jobs[job_id]["thumbnail_url"] = f"https://img.youtube.com/vi/{vid_id}/hqdefault.jpg"

        if not jobs[job_id].get("thumbnail_url") and video_path:
            info_path = video_path.parent / "info.json"
            if info_path.exists():
                import json as _json
                try:
                    with open(info_path, "r", encoding="utf-8") as f:
                        meta = _json.load(f)
                        if meta.get("thumbnail"):
                            jobs[job_id]["thumbnail_url"] = meta["thumbnail"]
                except Exception as e:
                    print(f"[WARN] Failed to read thumbnail from info.json: {e}")

        _log(job_id, "Download complete.")
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"]  = str(e)
        raise HTTPException(status_code=500, detail=str(e))

    return {"job_id": job_id}


@app.post("/analyze/{job_id}")
async def run_analysis(job_id: str):
    """
    Trigger the full AI analysis pipeline for an existing job.
    Runs the pipeline in a background asyncio task.

    📚 Why background task?
       Frame extraction + Whisper + Gemini can take 30-60 seconds.
       If we ran this synchronously, the HTTP request would hang.
       Instead we return immediately with {"started": True} and
       the frontend polls /status/{job_id} for progress.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    if not jobs[job_id].get("video_path"):
        raise HTTPException(status_code=400, detail="No video associated with this job.")

    # Start the pipeline as a background coroutine
    asyncio.create_task(_run_pipeline(job_id))

    return {"started": True, "job_id": job_id}


async def _run_pipeline(job_id: str):
    """
    The core AI pipeline. Runs asynchronously in the background.

    PIPELINE STAGES:
    ─────────────────
    1. Frame Extraction  (OpenCV  — CPU-bound → thread pool)
    2. Audio Transcription (Whisper — CPU-bound → thread pool)
    3. Gemini Analysis   (Gemini  — I/O-bound → can await directly)
    4. Store results
    """
    loop = asyncio.get_event_loop()
    video_path = Path(jobs[job_id]["video_path"])

    try:
        # Load info.json if it exists (contains title, description, and user comments)
        info_path = video_path.parent / "info.json"
        metadata = {}
        if info_path.exists():
            import json as _json
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    metadata = _json.load(f)
            except Exception as e:
                print(f"[WARN] Failed to load info.json: {e}")

        # ── Stage 1: Frame Extraction + Comment Fetch (parallel) ─────────────
        jobs[job_id]["status"] = "extracting"
        _log(job_id, "[1/4] Extracting key frames & fetching comments in parallel...")

        def _extract():
            return extract_frames(
                video_path, job_id,
                progress_callback=lambda m: _log(job_id, m)
            )

        # Fetch comments in parallel with frame extraction (non-blocking for speed)
        # We need the original URL — store it in the job if present
        url_for_comments = jobs[job_id].get("source_url", "")

        def _fetch_comments():
            if url_for_comments:
                return fetch_comments(
                    url_for_comments, job_id,
                    max_comments=20,
                    progress_callback=lambda m: _log(job_id, m)
                )
            return []

        # Run frame extraction and comment fetching in parallel.
        # Comment fetch has a hard 25s asyncio timeout — if yt-dlp hangs, we
        # continue with analysis (comments are context, not critical path).
        async def _fetch_comments_with_timeout():
            try:
                return await asyncio.wait_for(
                    loop.run_in_executor(None, _fetch_comments),
                    timeout=25.0,
                )
            except asyncio.TimeoutError:
                _log(job_id, "Comment fetch timed out — continuing without comments")
                return []

        frames, _ = await asyncio.gather(
            loop.run_in_executor(None, _extract),
            _fetch_comments_with_timeout(),
        )
        _log(job_id, f"Done: {len(frames)} frames extracted")


        # ── Stage 2: Audio Transcription ──────────────────────────────────────
        jobs[job_id]["status"] = "transcribing"
        _log(job_id, "[2/4] Transcribing audio with Whisper...")

        def _transcribe():
            return transcribe_video(
                video_path, job_id,
                progress_callback=lambda m: _log(job_id, m)
            )

        transcript_data = await loop.run_in_executor(None, _transcribe)
        _log(job_id, f"Done: {transcript_data['word_count']} words transcribed")

        # ── Stage 3: Gemini Vision Analysis ───────────────────────────────────
        jobs[job_id]["status"] = "analyzing"
        _log(job_id, "[3/4] Running Gemini 2.0 vision analysis...")

        # Reload metadata now — comments may have been fetched in parallel
        if info_path.exists():
            import json as _json
            try:
                with open(info_path, "r", encoding="utf-8") as f:
                    metadata = _json.load(f)
            except Exception:
                pass

        duration = transcript_data.get("duration", 0.0) or (len(frames) * 2.0)

        def _analyze():
            return analyze_video(
                frames, transcript_data, duration,
                progress_callback=lambda m: _log(job_id, m),
                metadata=metadata
            )

        result = await loop.run_in_executor(None, _analyze)
        _log(job_id, f"Gemini done: Hook {result.get('hook_score')}/100")

        # ── Sakana Fugu: Text Enhancement (runs after Gemini vision) ──────────
        # Sakana handles pure-text reasoning (no images) — much faster.
        # Enhances suggestions, hook_analysis, and target_audience.
        def _enhance():
            return ai_router.enhance_analysis_with_text_ai(
                result,
                transcript=transcript_data.get("full_text", ""),
                metadata=metadata,
                progress_callback=lambda m: _log(job_id, m),
            )

        result = await loop.run_in_executor(None, _enhance)

        # ── Stage 4: Music Detection via Shazam fingerprinting ────────────────
        jobs[job_id]["status"] = "detecting_music"
        _log(job_id, "[4/4] Identifying background music via Shazam...")

        def _detect_music():
            return detect_music_from_video(
                video_path,
                progress_callback=lambda m: _log(job_id, m)
            )

        music_result = await loop.run_in_executor(None, _detect_music)
        result["music"] = music_result

        if music_result.get("detected"):
            _log(job_id, f"Music: '{music_result['song_title']}' by {music_result['artist']}")
        else:
            # Fallback 1: Check Gemini-inferred music from context
            inf = result.get("inferred_music")
            if inf and inf.get("song_title"):
                music_result = {
                    "detected": True, "inferred": True,
                    "song_title": inf.get("song_title"),
                    "artist":     inf.get("artist") or "Unknown",
                    "album":      "Inferred from comments/content",
                    "label":      "AI Inference Fallback",
                    "genre":      "Inferred", "cover_url": "",
                    "apple_music_url": "",
                    "confidence": inf.get("confidence", 0.0),
                    "explanation": inf.get("explanation", "")
                }
                result["music"] = music_result
                _log(job_id, f"Music (Gemini Inferred): '{music_result['song_title']}'")
            else:
                # Fallback 2: Ask Sakana Fugu to infer from transcript + comments
                def _infer_music():
                    return ai_router.infer_music_with_text_ai(
                        transcript=transcript_data.get("full_text", ""),
                        metadata=metadata,
                        progress_callback=lambda m: _log(job_id, m),
                    )

                sakana_music = await loop.run_in_executor(None, _infer_music)
                if sakana_music and sakana_music.get("song_title"):
                    music_result = {
                        "detected": True, "inferred": True,
                        "song_title": sakana_music.get("song_title"),
                        "artist":     sakana_music.get("artist") or "Unknown",
                        "album":      "Inferred by Sakana Fugu",
                        "label":      "Sakana AI Inference",
                        "genre":      "Inferred", "cover_url": "",
                        "apple_music_url": "",
                        "confidence": sakana_music.get("confidence", 0.0),
                        "explanation": sakana_music.get("explanation", "")
                    }
                    result["music"] = music_result
                    _log(job_id, f"Music (Sakana Inferred): '{music_result['song_title']}'")
                else:
                    _log(job_id, f"Music: {music_result.get('reason', 'Not detected')}")

        # ── Store completed result ─────────────────────────────────────────────
        jobs[job_id]["status"] = "done"
        jobs[job_id]["result"] = result
        _log(job_id, f"✅ Analysis complete! Hook: {result.get('hook_score')}/100")

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"]  = str(e)
        _log(job_id, f"Pipeline error: {e}")
        print(f"[ERROR] Pipeline failed for job {job_id}: {e}")
        import traceback; traceback.print_exc()


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    """Return current job status, progress messages, and thumbnail URL."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = jobs[job_id]
    return {
        "job_id":        job_id,
        "status":        job["status"],
        "progress":      job["progress"],
        "error":         job.get("error"),
        "thumbnail_url": job.get("thumbnail_url"),
    }


async def _sse_generator(job_id: str) -> AsyncGenerator[str, None]:
    """
    Server-Sent Events generator — yields progress updates as they arrive.

    📚 How SSE works:
       • The browser opens one long-lived HTTP GET request
       • The server keeps the connection open and sends chunks
       • Each chunk is: "data: <json>\n\n"
       • The browser's EventSource API fires "message" events for each chunk
       • If the connection drops, EventSource auto-reconnects

    This is simpler than WebSockets for one-way communication.
    """
    last_idx = 0
    while True:
        if job_id not in jobs:
            yield 'data: {"error": "Job not found"}\n\n'
            break

        job = jobs[job_id]
        new_msgs = job["progress"][last_idx:]
        for msg in new_msgs:
            # JSON-encode the message to handle special characters safely
            import json as _json
            payload = _json.dumps({"message": msg, "status": job["status"]})
            yield f"data: {payload}\n\n"
            last_idx += 1

        if job["status"] in {"done", "error"}:
            import json as _json
            payload = _json.dumps({"status": job["status"], "done": True})
            yield f"data: {payload}\n\n"
            break

        await asyncio.sleep(0.5)  # Poll internal state every 500ms


@app.get("/stream/{job_id}")
async def stream_progress(job_id: str):
    """SSE endpoint — frontend connects here to receive live progress updates."""
    return StreamingResponse(
        _sse_generator(job_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control":   "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering (if behind proxy)
        },
    )


@app.get("/results/{job_id}")
async def get_results(job_id: str):
    """Return the completed analysis JSON for a done job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = jobs[job_id]
    if job["status"] != "done":
        raise HTTPException(status_code=202, detail="Analysis not complete yet.")
    return JSONResponse(content=job["result"])


@app.get("/frame/{job_id}/frames/{filename}")
async def serve_frame(job_id: str, filename: str):
    """Serve an extracted frame image file."""
    frame_path = TEMP_DIR / job_id / "frames" / filename
    if not frame_path.exists():
        raise HTTPException(status_code=404, detail="Frame not found.")
    return FileResponse(str(frame_path), media_type="image/jpeg")


@app.get("/download/frames/{job_id}")
async def download_frames_zip(job_id: str):
    """Stream all extracted frames as a ZIP archive."""
    import io, zipfile
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    frames_dir = TEMP_DIR / job_id / "frames"
    if not frames_dir.exists():
        raise HTTPException(status_code=404, detail="No frames found.")
    frame_files = sorted(frames_dir.glob("*.jpg"))
    if not frame_files:
        raise HTTPException(status_code=404, detail="No frames found.")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in frame_files:
            zf.write(f, arcname=f.name)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="frames_{job_id[:8]}.zip"'},
    )


@app.get("/report/pdf/{job_id}")
async def download_pdf_report(job_id: str):
    """
    Generate and stream a branded PDF analysis report.

    📚 Response() with raw bytes is more direct than FileResponse for
       dynamically-generated content that lives in memory (not on disk).
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = jobs[job_id]
    if job["status"] != "done":
        raise HTTPException(status_code=202, detail="Analysis not complete yet.")

    result = job["result"]
    if not result:
        raise HTTPException(status_code=404, detail="No result found.")

    loop = asyncio.get_event_loop()
    pdf_bytes = await loop.run_in_executor(None, lambda: generate_pdf_report(result))

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="clipinsight_report_{job_id[:8]}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@app.post("/share/{job_id}")
async def create_share_link(job_id: str):
    """
    Create a shareable token for a completed analysis.
    Returns a short token that can be used at GET /shared/{token}.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    if jobs[job_id]["status"] != "done":
        raise HTTPException(status_code=400, detail="Analysis not complete yet.")

    # Generate a short 8-character token
    token = str(uuid.uuid4())[:8]
    share_tokens[token] = job_id
    return {"token": token, "url": f"/shared/{token}"}


@app.get("/shared/{token}")
async def get_shared_result(token: str):
    """Retrieve a shared analysis result by token."""
    job_id = share_tokens.get(token)
    if not job_id:
        raise HTTPException(status_code=404, detail="Share link not found or expired.")
    result = jobs.get(job_id, {}).get("result")
    if not result:
        raise HTTPException(status_code=404, detail="Result not found.")
    return JSONResponse(content=result)

