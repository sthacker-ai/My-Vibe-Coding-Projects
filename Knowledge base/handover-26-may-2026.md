# KnowledgeBase — Handover: 26 May 2026

> Picking back up after 10 days. Everything below describes the exact state of the project as of this commit.

---

## ✅ What's Done (Production-Ready)

### Core Pipeline (runs daily at 6am IST via Windows Task Scheduler)
| Step | Script | Status |
|---|---|---|
| 1. Import X likes | `scripts/import-x-likes.js --limit 25` | ✅ Running daily |
| 2. Extract sources | `scripts/import-x-source.js` | ✅ Running daily |
| 3. Classify topics | `scripts/classify-source.js` | ✅ Running daily |
| 4. Compile courses | `scripts/compile-course.js` | ✅ Running daily |
| 5. Topic summaries | `scripts/update-topic-summary.js` | ✅ Running daily |
| 6. Knowledge graph | `scripts/build-graph.js` | ✅ Running daily |
| 7. Transcripts | `scripts/extract-transcripts.js` | ✅ Running daily |

### Content (as of this commit)
- **119 courses** across 16 topics (ai-agents, claude-ai, finance, startup, etc.)
- **16 Mermaid diagrams** added to courses (auto-generated, embedded in course markdown)
- **18 hero images** generated (ai-agents: 18/40 — see "In Progress" below)
- **1 podcast script** generated (ai-agents/course-001, no MP3 yet)
- All content in `content/courses/{topic}/`, images in `public/course-assets/{topic}/`

### Database (PostgreSQL)
- 6 tables: `learning_progress`, `reading_sessions`, `daily_streaks`, `pipeline_runs`, `token_usage`, `course_index`
- `db:setup` and `db:sync` run successfully
- All pipeline scripts do dual-write: flat JSON files + PostgreSQL

### AI Client (`scripts/lib/ai-client.js`) — Fully Hardened
**Provider chain with circuit breaker:**
1. **OpenRouter** — `nvidia/nemotron-3-super-120b-a12b:free` (primary) → `google/gemma-4-31b-it:free` (fallback)
   - ⚡ Circuit breaker: first 429/rate-limit from OpenRouter sets `_openRouterDead = true` for the whole process run — all subsequent calls skip directly to NVIDIA NIM
2. **NVIDIA NIM** — `mistralai/mistral-large-3-675b-instruct-2512` (675B MoE, free tier)
   - ⚡ Circuit breaker: same pattern — `_nvidiaDead = true` if rate-limited → falls to Ollama
3. **Ollama** — `gemma4:e2b` (local, last resort)

### TTS / STT Architecture
- **TTS (Podcast audio)**: Magpie TTS via NVIDIA NIM (`nvidia/magpie-tts-multilingual`)
  - ALEX = male explainer (`Magpie-Multilingual.EN-US.Male.Neutral`)
  - SAM = female questioner (`Magpie-Multilingual.EN-US.Female.Neutral`)
  - Override via `MAGPIE_VOICE_MALE` / `MAGPIE_VOICE_FEMALE` env vars
  - Voice list: https://docs.nvidia.com/deeplearning/riva/user-guide/docs/tts/tts-overview.html
- **STT (Video transcription)**: Groq `whisper-large-v3-turbo` → local `faster-whisper` fallback

### Image Generation (`scripts/generate-course-assets.js`)
- **Image API**: Pollinations.AI — FLUX model, free, no key needed, 1280×720 JPEG
  - Gemini Imagen 3 was free but removed; Imagen 4 is paid-only → switched to Pollinations
- **Prompt generation**: Routes through `ai-client.js` (OpenRouter → NVIDIA NIM → Ollama)
- **Diagrams**: Same AI chain decides if Mermaid is worth adding per course

### Admin Console (`/admin`)
- 9 pipeline buttons including "Generate Images" and "Generate Podcasts"
- Each step can be triggered manually without running the full pipeline

---

## 🔄 In Progress (Pick Up Here)

### 1. Hero Images — INCOMPLETE, needs rerun
```bash
cd "Knowledge base"
node scripts/generate-course-assets.js
```
**Current state**: 18/119 images done (ai-agents: 18/40). Run stopped.
**What it does**: Skips already-generated images (idempotent) — safe to rerun.
**Expected time**: ~30–40 min for remaining 101 images (NVIDIA NIM ~8s/call + Pollinations ~5s/image).
**Rate limits**: OpenRouter 50/day (circuit breaker handles it); NVIDIA NIM ~40 req/min.
**Note**: Run it in a terminal and leave it — it'll finish on its own.

### 2. Podcast Scripts + Audio — NOT STARTED
```bash
# Step 1: Test one course end-to-end first
node scripts/generate-podcast.js --topic ai-agents --course course-001

# Step 2: If that works, run all 119
node scripts/generate-podcast.js
```
**What it does**: 
1. AI generates a 10–14 exchange ALEX/SAM dialogue script (~1100 words)
2. Python calls Magpie TTS for each segment → WAV → MP3 via ffmpeg
3. Saves script to `content/courses/{topic}/audio/{course}-podcast-script.txt`
4. Saves MP3 to `public/course-audio/{topic}/{course}-podcast.mp3`

**Known issue to watch for**: Magpie TTS endpoint/voice names were not confirmed from docs (docs 404'd during setup). The endpoint `POST https://integrate.api.nvidia.com/v1/audio/speech` and voice names `Magpie-Multilingual.EN-US.Male.Neutral` are our best guess. **Test the single course first** and check for HTTP errors. If you get a 404 or 422, the voice name format may need adjusting — check `MAGPIE_VOICE_MALE` / `MAGPIE_VOICE_FEMALE` in `.env`.

**Expected time**: ~2–3 min per course (AI script + ~12 TTS segments). 119 courses = 4–6 hours total. Run overnight.

---

## 🔜 What Comes Next (After Assets Are Done)

### 3. Start the Dev Server and Review
```bash
cd "Knowledge base"
npm run dev   # starts on port 3005
```
- Visit `http://localhost:3005` to see the full site
- Check `/courseware` for topic cards
- Click into any course to see hero image, Mermaid diagram, and audio player
- Check `/admin` for pipeline controls

### 4. Daily Pipeline: Add generate:assets + generate:podcasts
Right now, the daily scheduled task (`scripts/scheduled-daily.js`) runs steps 1–7 but does NOT auto-generate images or podcasts for new courses.

**Decision needed**: Do you want new courses to auto-get images and podcasts on every daily run, or keep it manual?
- If yes → add these two steps to `scheduled-daily.js` after the existing ones
- If manual → the Admin Console buttons are already there

### 5. Git Push to Remote
The `My-Vibe-Coding-Projects` repo is at `sthacker-ai/My-Vibe-Coding-Projects` on GitHub. Push when ready.

---

## 🔑 Key Files Changed This Session

| File | What Changed |
|---|---|
| `scripts/lib/ai-client.js` | + NVIDIA NIM fallback; + circuit breaker (skips dead providers per run) |
| `scripts/generate-course-assets.js` | Switched from Gemini Imagen → Pollinations.AI; routes AI through ai-client.js |
| `scripts/generate-podcast.js` | Routes AI through ai-client.js (was hardcoded OpenRouter) |
| `scripts/transcribe/generate_audio.py` | Full swap: edge-tts → Magpie TTS; ALEX=male, SAM=female; dotenv loader added |
| `scripts/scheduled-daily.js` | Tweet limit 50 → 25 |
| `app/api/admin/run/route.ts` | Tweet limit 50 → 25 |
| `.env` | + `NVIDIA_API_KEY`, `MAGPIE_VOICE_MALE`, `MAGPIE_VOICE_FEMALE` |

---

## ⚙️ Environment Checklist

| Var | Status | Used for |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ Set | LLM primary/fallback |
| `NVIDIA_API_KEY` | ✅ Set (70 chars) | LLM fallback 2 + Magpie TTS |
| `GROQ_API_KEY` | ✅ Set | Video transcription (STT) |
| `GEMINI_API_KEY` | ✅ Set (not used for images anymore) | No active use now |
| `DATABASE_URL` | ✅ Set | PostgreSQL |
| `X_AUTH_TOKEN` / `X_CT0` | ✅ Set | X/Twitter scraping |

---

## 🚀 Quick Start Commands (When You Return)

```bash
# 1. Resume image generation (skips already done)
cd "c:\My stuff\My Vibe Coding Projects\Knowledge base"
node scripts/generate-course-assets.js

# 2. Test podcast pipeline (one course)
node scripts/generate-podcast.js --topic ai-agents --course course-001

# 3. If podcast works, run all
node scripts/generate-podcast.js

# 4. Start dev server
npm run dev   # http://localhost:3005
```

---

*Last updated: 26 May 2026*
