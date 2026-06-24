<div align="center">

# 🌸 ClipInsight AI
### *桜の知恵 — Wisdom of the Cherry Blossom*

**Multimodal AI video analyzer for Instagram Reels & YouTube Shorts**

[![Python](https://img.shields.io/badge/Python-3.11+-blue?style=flat-square&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Gemini](https://img.shields.io/badge/Google_Gemini-AI-orange?style=flat-square&logo=google)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

![ClipInsight AI Demo](linkedin_content/screenshots/01_results_dashboard.png)

</div>

---

## 🎯 What it does

Paste any **YouTube Short** or **Instagram Reel** URL → ClipInsight AI runs a full multimodal analysis pipeline and returns:

| Feature | Technology | Details |
|---|---|---|
| 🖼 **Frame extraction** | OpenCV | 40 key frames sampled uniformly |
| 🎙 **Audio transcription** | OpenAI Whisper | Local, no API cost, multilingual |
| 🧠 **AI content analysis** | Google Gemini | Hook score, sentiment, tags, suggestions |
| 🎵 **Music identification** | Shazam FFT | Song, artist, album, cover art |
| 📊 **Hook Score** | Custom scoring | 0–100 rating of first 3 seconds |
| 📦 **Export** | JSZip + PDF | Download frames ZIP + full PDF report |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│   Three.js Sakura BG  │  Progress Tracker  │  Dashboard │
└──────────────────────────────┬──────────────────────────┘
                               │ HTTP / SSE
┌──────────────────────────────▼──────────────────────────┐
│                    FastAPI Backend                       │
│                                                          │
│  URL/Upload → yt-dlp Download                           │
│       ↓                                                  │
│  OpenCV Frame Extraction (40 frames)                    │
│       ↓                                                  │
│  Whisper Transcription (local CPU)                      │
│       ↓                                                  │
│  Gemini Multimodal Analysis (frames + transcript)       │
│       ↓                                                  │
│  Shazam Music Detection (FFT fingerprinting)            │
│       ↓                                                  │
│  Structured JSON Result (Pydantic validated)            │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- FFmpeg ([install guide](https://ffmpeg.org/download.html))
- Google Gemini API key ([get one free](https://ai.google.dev))

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/clipinsight-ai.git
cd clipinsight-ai

# Backend
pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install
```

### 2. Configure API key

```bash
cp .env.example .env
# Edit .env and add your Gemini API key
```

### 3. Run

```bash
# Terminal 1 — Backend
python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:3000** 🌸

---

## 💡 How the AI Pipeline Works

### Token Cost Per Analysis
| Component | Tokens | Cost |
|---|---|---|
| 15 frames × 258 tokens | 3,870 | ~$0.00008 |
| Text prompt | ~450 | ~$0.000009 |
| JSON response | ~420 | ~$0.000008 |
| **Total** | **~4,740** | **≈ $0.0001** |

Whisper (transcription) + Shazam (music) = **$0.00** — fully local.

### Music Detection (No API Key Required)
We implement Shazam's fingerprinting algorithm from scratch in pure Python:
1. Extract 15s of mono 16kHz PCM audio via FFmpeg
2. Apply Hann window + FFT to get frequency spectrum
3. Find constellation peaks across 6 frequency bands
4. Package as binary signature → POST to Shazam discovery API
5. Returns: song, artist, album, genre, cover art, Apple Music link

---

## 🖼 Screenshots

| Homepage | Analysis in Progress | Results Dashboard |
|---|---|---|
| ![Home](linkedin_content/screenshots/04_homepage.png) | | ![Results](linkedin_content/screenshots/01_results_dashboard.png) |

| Insights & Hook Score | Extracted Frames |
|---|---|
| ![Insights](linkedin_content/screenshots/02_insights_view.png) | ![Frames](linkedin_content/screenshots/03_frames_view.png) |

---

## 🧰 Tech Stack

**Backend**
- `FastAPI` — async Python web framework
- `yt-dlp` — video downloading from 1000+ sites
- `OpenCV` — computer vision frame extraction
- `openai-whisper` — local speech-to-text (tiny model)
- `google-genai` — Gemini multimodal AI SDK
- `Pydantic` — structured output validation
- `uvicorn` — ASGI server

**Frontend**
- `Next.js 15` — React framework with App Router
- `Three.js` — 3D sakura particle system (8,000 petals)
- `GSAP` — smooth scroll animations
- `JSZip` — client-side ZIP generation

---

## 🗺️ Roadmap

- [x] Phase 1 — Core pipeline (frames + transcription + Gemini)
- [x] Phase 2 — Music detection + download system
- [ ] Phase 3 — PDF export + share links + thumbnail preview
- [ ] Phase 4 — Batch comparison + history panel
- [ ] Phase 5 — User accounts + persistent history
- [ ] Phase 6 — TikTok deep integration + browser extension
- [ ] Phase 7 — Monetization (credits + API)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with 🌸 and a lot of cherry blossoms</sub>
</div>
