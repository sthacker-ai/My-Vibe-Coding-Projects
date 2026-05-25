# X Likes Importer

This importer brings liked X/Twitter posts into the local KnowledgeBase vault.
It does not use Google Sheets and does not require the X API.

## One-Time Setup

Playwright Chromium has been installed for this repo.

Create or refresh the X login session:

```bash
npm run import:x-login
```

This opens a Chromium window. Log into X as `@Pond_er_er`, then return to the
terminal and press Enter. The session is saved to:

```text
data/private/x-storage-state.json
```

That file is ignored by git.

## Import Latest Likes

```bash
npm run import:x-likes
```

Default behavior:

- imports up to 10 new liked tweets
- skips tweet IDs already seen
- writes raw JSON to `data/raw/tweets/`
- writes Markdown source notes to `content/sources/x/`
- writes run logs to `data/runs/`
- maintains dedupe state in `data/indexes/seen-tweets.json`

## Backfill

```bash
npm run import:x-likes:backfill
```

Backfill currently uses the same scrolling/dedupe strategy with a different
mode label in the run log. Later we can make it maintain a separate historical
cursor if needed.

## Important Notes

- If X changes its UI, the Playwright selectors may need adjustment.
- If X asks for a challenge or login again, rerun `npm run import:x-login`.
- The importer stores topic as `Uncategorized` for now. Topic classification is
  Phase 3 and will use Ollama.
- X-hosted video and long-form article extraction are Phase 2. Phase 1 preserves
  the tweet, URLs, images, and any directly visible media URLs from the liked
  timeline.
