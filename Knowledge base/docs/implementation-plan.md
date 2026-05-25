# KnowledgeBase Implementation Plan

## Current Project Intent

Build a local-first personal knowledge system that imports liked X/Twitter posts,
extracts their linked/embedded learning material, and turns each source into
courseware. Related sources should accumulate under shared topic folders, and
each topic should maintain a living summary course that improves as new sources
arrive.

The same Markdown content should work in:

- the Next.js web app
- Obsidian as a local vault
- GitHub as versioned source control

## User Decisions Captured

- X/Twitter handle: `@Pond_er_er`
- First import limit: `10` liked tweets per run
- Import should support both on-demand and scheduled runs
- Existing `MyTweets` scraper may be reused, but code should be copied/refactored
  into this repo so there is only one project to maintain
- Local AI provider: Ollama
- Ollama endpoint: `http://localhost:11434`
- Ollama model: `gemma4:e2b`
- Start free/local-first; avoid hosted databases for now
- Use the repo-local `content/` folder as the Obsidian vault

## Sample Sources To Test

1. X-hosted video:
   `https://x.com/sairahul1/status/2056411519337042350`
2. X article / long-form post:
   `https://x.com/sairahul1/status/2056292143472202110`

For the X article, the scraper should attempt to preserve article text and any
embedded rich/code/canvas-like blocks. If the block cannot be faithfully
converted to Markdown, store a screenshot or structured raw HTML/DOM extract as
supporting evidence.

## Storage Model

The canonical source of truth should be local files.

```text
content/
  sources/
    x/
      <tweet-id>.md
    youtube/
      <video-id>.md
    articles/
      <slug>.md
  courses/
    <topic-slug>/
      course-001.md
      course-002.md
      summary.md
  wiki/
    <Topic Name>.md
  assets/
    x/
    articles/
    videos/

data/
  raw/
    tweets/
      <tweet-id>.json
  transcripts/
  indexes/
    seen-tweets.json
    topics.json
    graph.json
  runs/
    <timestamp>.json
```

## Tweet Record Fields

Each imported tweet should preserve:

- `tweet_id`
- `tweet_url`
- `author_handle`
- `author_name`
- `tweet_text`
- `tweet_published_at`
- `scraped_at`
- `liked_by`
- `media`
- `image_urls`
- `video_urls`
- `outbound_urls`
- `source_type`
- `topic_slug`
- `topic_label`
- `processing_status`
- `error`

## Courseware Behavior

For every imported source:

1. Save raw source data.
2. Save a human-readable source Markdown note.
3. Classify topic/category.
4. Extract article/video/transcript/text/media.
5. Generate one source-specific course:
   `content/courses/<topic-slug>/course-XXX.md`
6. Update or create:
   `content/courses/<topic-slug>/summary.md`
7. Update or create:
   `content/wiki/<Topic Name>.md`
8. Rebuild graph index:
   `data/indexes/graph.json`

Example:

```text
content/courses/claude-code/course-001.md
content/courses/claude-code/course-002.md
content/courses/claude-code/summary.md
content/wiki/Claude Code.md
```

The summary page should synthesize all courses under that topic, not just append
the newest one.

## Planned Scripts

Add these scripts to the main `Knowledge base` repo:

```text
scripts/import-x-likes.js
scripts/import-x-source.js
scripts/extract-source.js
scripts/compile-course.js
scripts/update-topic-summary.js
scripts/build-graph.js
scripts/run-pipeline.js
```

Suggested package scripts:

```json
{
  "import:x-likes": "node scripts/import-x-likes.js --limit 10",
  "import:x-source": "node scripts/import-x-source.js",
  "process:sources": "node scripts/run-pipeline.js",
  "graph:build": "node scripts/build-graph.js"
}
```

## Import Strategy

Use Playwright first, based on the existing `MyTweets` project.

Changes from `MyTweets`:

- remove Google Sheets dependency
- write raw JSON and Markdown locally
- keep dedupe in `data/indexes/seen-tweets.json`
- keep run logs in `data/runs/`
- support `--limit 10`
- support `--mode latest`, `--mode backfill`, and later `--mode retry`
- use a saved X session state file

Potential storage state path:

```text
data/private/x-storage-state.json
```

Add `data/private/` to `.gitignore`.

## Dedupe Strategy

Maintain `data/indexes/seen-tweets.json`.

Shape:

```json
{
  "tweet_ids": {
    "2056411519337042350": {
      "first_seen_at": "2026-05-20T00:00:00.000Z",
      "tweet_url": "https://x.com/sairahul1/status/2056411519337042350",
      "status": "imported"
    }
  }
}
```

Before saving a new tweet, check this index. If present, skip it. This makes
on-demand and scheduled runs idempotent.

## AI Strategy

Use Ollama first.

Environment variables:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
```

The scripts should do the tool work:

- fetch tweet data
- fetch linked pages
- fetch transcripts
- save files

The model should only receive extracted text/metadata and return structured
JSON or Markdown.

If `gemma4:e2b` is too weak for polished courseware, keep the provider interface
pluggable so a hosted API model can be added later without rewriting the
pipeline.

## Video Strategy

For YouTube:

- fetch transcript first
- embed original video iframe in generated courseware
- store transcript under `data/transcripts/`

For X-hosted video:

- capture tweet metadata and media URLs if available
- embed tweet/video where possible
- if transcript is unavailable, mark as `needs_transcription`
- later add local audio extraction/transcription if needed

## X Article Strategy

For X long-form articles:

- open the tweet/article in Playwright
- extract visible article text
- extract links and images
- attempt to extract code blocks or rich embedded blocks
- if a canvas/code window cannot be converted cleanly, save a screenshot in
  `content/assets/x/<tweet-id>/`
- reference the screenshot from the source note/course

## Scheduling Options

Start with manual/on-demand:

```bash
npm run import:x-likes
npm run process:sources
```

Then add one of:

1. Windows Task Scheduler
2. Codex automation heartbeat/cron if appropriate
3. A local `node-cron` scheduler process

Preferred first durable option: Windows Task Scheduler, because it works without
keeping this chat session alive.

## Implementation Phases

### Phase 1: Local Importer

- [ ] Copy/refactor useful Playwright scraping logic from `MyTweets`
- [ ] Add local env variables to `.env.example`
- [ ] Add `data/private/` and generated data patterns to `.gitignore`
- [ ] Implement `scripts/import-x-likes.js`
- [ ] Save raw tweet JSON to `data/raw/tweets/`
- [ ] Save source notes to `content/sources/x/`
- [ ] Maintain `data/indexes/seen-tweets.json`
- [ ] Test with `--limit 10`

### Phase 2: Single Source Extraction

- [ ] Implement `scripts/import-x-source.js`
- [ ] Test direct source import for sample tweet 1
- [ ] Test direct source import for sample tweet 2
- [ ] Extract article text / rich blocks / screenshots where possible
- [ ] Detect X-hosted video vs YouTube vs article vs plain tweet

### Phase 3: AI Classification

- [ ] Add Ollama client wrapper
- [ ] Classify topic/category from tweet/source text
- [ ] Generate topic slug and label
- [ ] Save topic index to `data/indexes/topics.json`
- [ ] Add retry/fallback if model output is malformed

### Phase 4: Course Generation

- [ ] Generate source-specific course Markdown
- [ ] Include original tweet metadata
- [ ] Include embedded video/tweet/article reference
- [ ] Include chapters, exercises, key takeaways, and review questions
- [ ] Save as `content/courses/<topic-slug>/course-XXX.md`

### Phase 5: Living Topic Summary

- [ ] Read all courses for a topic
- [ ] Generate/update `summary.md`
- [ ] Preserve source references
- [ ] Add "what changed since last update" section
- [ ] Add `[[wikilinks]]` to related topics

### Phase 6: Graph

- [ ] Parse Markdown wikilinks
- [ ] Parse frontmatter tags/topics
- [ ] Build `data/indexes/graph.json`
- [ ] Show real graph data in the Next.js app
- [ ] Ensure Obsidian can see equivalent links via Markdown

### Phase 7: Web App Views

- [ ] Source inbox page
- [ ] Topic page
- [ ] Course reader page
- [ ] Summary course page
- [ ] Graph page
- [ ] Processing status page

### Phase 8: Scheduling

- [ ] Add on-demand import command
- [ ] Add Windows Task Scheduler instructions
- [ ] Add run logs
- [ ] Add failure report page or file

## Next Session Resume Point

Phase 1 has started. Current implementation added:

- `scripts/import-x-likes.js`
- `npm run import:x-login`
- `npm run import:x-likes`
- `npm run import:x-likes:backfill`
- local raw tweet/source note/run log folders
- local dedupe index path
- Playwright Chromium setup

The next manual action is:

```bash
npm run import:x-login
```

After logging into X in the opened Chromium window, return to the terminal and
press Enter to save `data/private/x-storage-state.json`.

Then run:

```bash
npm run import:x-likes
```

Resume implementation here after the first real import:

1. Open this file.
2. Verify up to 10 liked tweets were saved under `data/raw/tweets/`.
3. Verify Markdown notes were saved under `content/sources/x/`.
4. Verify rerunning the import skips duplicate tweet IDs.
5. Do not start AI course generation yet.
6. First success condition:

```bash
npm run import:x-likes
```

imports up to 10 liked tweets for `@Pond_er_er`, saves raw JSON locally, creates
source Markdown notes, and skips duplicate tweet IDs on rerun.

## Open Questions For Later

- Should X raw media be downloaded locally or referenced by URL first?
- Should generated courseware include screenshots by default or only when rich
  content cannot be represented in Markdown?
- Should topic matching be conservative, asking for user confirmation when
  uncertain?
- Should low-confidence topics go into `content/courses/uncategorized/`?
