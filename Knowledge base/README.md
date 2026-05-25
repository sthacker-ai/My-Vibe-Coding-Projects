# KnowledgeBase

A **local-first personal knowledge base** that automatically ingests X/Twitter liked posts, transcribes videos, and uses AI to generate structured courseware and wiki pages — all browsable via a Next.js web app.

---

## Architecture

```mermaid
flowchart LR
    X["X/Twitter Likes"] -->|import-x-likes.js| RAW["data/raw/*.json"]
    YT["YouTube / X Video"] -->|yt-dlp + Groq/Whisper| TRANS["data/transcripts/"]
    RAW -->|import-x-source.js| EXTRACT["Extracted content"]
    EXTRACT -->|classify-source.js + OpenRouter| CLASSIFY["topic_slug assigned"]
    CLASSIFY -->|compile-course.js| COURSES["content/courses/topic/course-NNN.md"]
    COURSES -->|update-topic-summary.js| WIKI["content/wiki/topic.md"]
    COURSES & WIKI -->|build-graph.js| GRAPH["data/indexes/graph.json"]
    COURSES & WIKI & GRAPH -->|Next.js 15| APP["http://localhost:3005"]
    APP --> ADMIN["Admin Console /admin"]
    APP --> LEARN["Learning Tracker (PostgreSQL)"]
    COURSES -->|export-obsidian.js| VAULT["data/obsidian-vault/"]
```

---

## Features

| Feature | Description |
|---|---|
| **X/Twitter ingestion** | Pulls liked tweets via Playwright scraper |
| **Video transcription** | yt-dlp + Groq API (fast, free) with faster-whisper fallback |
| **AI courseware** | OpenRouter (nvidia/nemotron-3 primary) generates rich course docs per source |
| **Topic category nav** | Browse topics as cards; each topic has its own page with course list + search |
| **Wiki pages** | Per-topic reference pages with [[wikilinks]] |
| **Knowledge graph** | Interactive D3 force-directed graph at `/graph` |
| **Admin console** | Run pipeline steps, edit AI prompts, import URLs |
| **Run history** | Per-run manifest with step-level status at `/runs` |
| **Token tracking** | Per-call token usage log at `/tokens` |
| **Learning tracker** | PostgreSQL — track progress, reading sessions, daily streaks |
| **Obsidian export** | Full vault export with [[wikilinks]], ready to open in Obsidian |
| **Daily automation** | Windows Task Scheduler runs pipeline at 6:00 AM IST |

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** CSS custom properties (no Tailwind)
- **Scraping:** Playwright (headless Chromium)
- **Transcription:** yt-dlp + Groq API (`whisper-large-v3-turbo`, free tier) → faster-whisper fallback
- **AI:** OpenRouter API (`nvidia/nemotron-3-super-120b-a12b:free` primary, `google/gemma-4-31b-it:free` fallback) + Ollama local fallback
- **Database:** PostgreSQL (learning tracker only; content is file-based)
- **Graph:** D3.js v7

---

## Setup

### 1. Prerequisites

- Node.js 22+
- Python 3.10+ (for transcription)
- PostgreSQL (for learning tracker, optional)

### 2. Install dependencies

```bash
npm install
pip install yt-dlp faster-whisper groq
```

### 3. Configure `.env`

```env
# AI
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL_PRIMARY=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_MODEL_FALLBACK=google/gemma-4-31b-it:free

# Groq (fast transcription — free at console.groq.com)
GROQ_API_KEY=gsk_...

# X/Twitter
X_AUTH_TOKEN=...
X_CT0=...

# PostgreSQL (optional — only for learning tracker)
DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/knowledgebase

# Obsidian export
OBSIDIAN_VAULT_DIR=./data/obsidian-vault
```

### 4. Create PostgreSQL database (optional)

```bash
psql -U postgres -c 'CREATE DATABASE "KnowledgeBase";'
npm run db:setup
```

### 5. Run the app

```bash
npm run dev
# → http://localhost:3005
```

---

## Pipeline

Run the full pipeline from the **Admin Console** at `/admin`, or via npm scripts:

```bash
npm run import:x-likes          # Pull latest 50 liked tweets
npm run extract:sources         # Scrape content from tweet URLs
npm run classify:sources        # AI-classify each source into a topic
npm run compile:courses         # Generate courseware from classified sources
npm run summarize:topics        # Build wiki summary pages
npm run graph:build             # Regenerate knowledge graph JSON
npm run export:obsidian         # Export Obsidian vault
```

Or run everything at once:

```bash
npm run pipeline:run
```

### Daily Automation (Windows)

The `start-scheduled.bat` file is registered with Windows Task Scheduler to run at 6:00 AM daily.

---

## App Pages

| Route | Description |
|---|---|
| `/` | Overview dashboard |
| `/sources` | Full source inbox |
| `/courseware` | Topic cards — click to browse courses |
| `/courseware/[topic]` | Topic overview with course list + search |
| `/courseware/[topic]/[course]` | Individual course reader |
| `/wiki` | Wiki topic index |
| `/wiki/[topic]` | Wiki page for a topic |
| `/graph` | Interactive D3 knowledge graph |
| `/runs` | Pipeline run history with per-step detail |
| `/tokens` | AI token usage tracker |
| `/admin` | Admin console (pipeline, prompts, import) |

---

## AI Prompt Customization

Edit prompts at `/admin` → **AI Prompts** section, or directly in `data/prompts.json`. Changes take effect on the next pipeline run (no restart needed).

Three prompt sets:
- `compile_course_*` — controls courseware generation
- `summarize_topic_*` — controls wiki page generation
- `classify_source_*` — controls topic classification

---

## Obsidian Integration

```bash
npm run export:obsidian
# → data/obsidian-vault/
```

Open `data/obsidian-vault/` as a vault in Obsidian. Includes:
- `Topics/` — wiki pages with [[wikilinks]]
- `Courses/[Topic]/` — course files with backlinks
- `Sources/` — raw source notes
- `Index.md` — master index
