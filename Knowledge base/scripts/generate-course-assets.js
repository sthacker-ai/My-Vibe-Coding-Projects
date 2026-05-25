#!/usr/bin/env node
/**
 * generate-course-assets.js — Generate hero images (and optionally Mermaid diagrams)
 * for every course in content/courses/.
 *
 * Pipeline:
 *   1. AI (OpenRouter → NVIDIA NIM fallback)  → concise image prompt (80 words)
 *   2. Pollinations.AI (FLUX model, free, no key) → 16:9 hero image (1280×720)
 *   3. Saved to public/course-assets/{topic}/{course}-hero.jpg
 *   4. (Optional) AI detects if course has a clear flow/process → Mermaid diagram
 *      appended to course markdown with <!-- auto-diagram --> marker (idempotent)
 *
 * Usage:
 *   node scripts/generate-course-assets.js
 *   node scripts/generate-course-assets.js --topic ai-agents
 *   node scripts/generate-course-assets.js --topic ai-agents --course course-001
 *   node scripts/generate-course-assets.js --force          (regenerate existing)
 *   node scripts/generate-course-assets.js --no-images      (diagrams only)
 *   node scripts/generate-course-assets.js --no-diagrams    (images only)
 *
 * Env vars required:
 *   OPENROUTER_API_KEY or NVIDIA_API_KEY  — for generating image prompts + diagrams
 *   (No image API key needed — Pollinations.AI is free and keyless)
 */
require("dotenv").config();
const fs   = require("fs");
const path = require("path");
const { aiGenerate } = require("./lib/ai-client");

const ROOT        = process.cwd();
const COURSES_DIR = path.join(ROOT, "content", "courses");
const OUT_DIR     = path.join(ROOT, "public", "course-assets");

// ── CLI flags ────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const ONLY_TOPIC  = argv.includes("--topic")   ? argv[argv.indexOf("--topic")  + 1] : null;
const ONLY_COURSE = argv.includes("--course")  ? argv[argv.indexOf("--course") + 1] : null;
const FORCE       = argv.includes("--force");
const SKIP_IMAGES = argv.includes("--no-images");
const SKIP_DIAG   = argv.includes("--no-diagrams");

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function parseFrontmatter(raw) {
  const out = {};
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return out;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") break;
    const m = lines[i].match(/^([\w_-]+):\s*(.+)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function contentSample(raw, maxWords = 220) {
  const body = raw.replace(/^---[\s\S]*?---\n?/, "").trim();
  return body.split(/\s+/).slice(0, maxWords).join(" ");
}

// ── AI helper (uses ai-client.js: OpenRouter → NVIDIA NIM → Ollama) ─────────
async function orChat(systemPrompt, userMsg, maxTokens = 200) {
  return aiGenerate(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
    { maxTokens, label: "assets" },
  );
}

// ── Pollinations.AI image generation (free, no key, FLUX model) ──────────
async function generateImage(prompt) {
  const encoded = encodeURIComponent(prompt);
  const seed    = Math.floor(Math.random() * 999999);
  const url     = `https://image.pollinations.ai/prompt/${encoded}?width=1280&height=720&nologo=true&model=flux&seed=${seed}`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Pollinations ${res.status}: ${txt.slice(0, 200)}`);
  }
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ── Image prompt generation ───────────────────────────────────────────────────
async function buildImagePrompt(title, topicLabel, sample) {
  const system = `You are a visual art director creating image prompts for educational course thumbnails.
Given a course title, topic, and content summary, write a concise Imagen prompt (max 75 words) for a visually striking 16:9 header image.

Rules:
- Abstract/conceptual digital art — no realistic people, no text, no logos in the image
- Match the concept: AI/ML = neural networks / glowing nodes; code = circuit patterns; finance = charts/coins; writing = typography/paper; productivity = clean minimal workspace
- Style suffix to always include: "digital illustration, flat design with depth, dark background with vibrant accent colors, professional, high detail"
- Output ONLY the prompt text. No explanation. No quotes.`;

  const reply = await orChat(system, `Title: ${title}\nTopic: ${topicLabel}\nContent: ${sample}`);
  return reply.slice(0, 400); // safety cap
}

// ── Diagram generation ────────────────────────────────────────────────────────
async function tryDiagram(title, sample) {
  const system = `You are a technical educator. Given a course title and content, decide if a Mermaid diagram would clearly illustrate a key concept — process flow, decision tree, system architecture, comparison, or timeline.

If a diagram would add value:
- Respond with a valid Mermaid code block (flowchart LR, sequenceDiagram, or mindmap)
- Keep it concise: max 12 nodes / steps
- Start with \`\`\`mermaid and end with \`\`\`

If no diagram is needed (e.g. opinion pieces, pure theory, lists):
- Respond with exactly: SKIP

Output ONLY the Mermaid block or "SKIP". Nothing else.`;

  const reply = await orChat(system, `Title: ${title}\n\n${sample}`, 350);
  if (!reply || reply.trim() === "SKIP" || !reply.includes("mermaid")) return null;
  const match = reply.match(/```mermaid[\s\S]*?```/);
  return match ? match[0] : null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Validate env — no image API key needed (Pollinations.AI is free and keyless)
  if (!fs.existsSync(COURSES_DIR)) {
    console.error("[assets] content/courses/ not found. Run the pipeline first.");
    process.exit(1);
  }

  const topicDirs = fs.readdirSync(COURSES_DIR)
    .filter((n) => fs.statSync(path.join(COURSES_DIR, n)).isDirectory())
    .filter((n) => !ONLY_TOPIC || n === ONLY_TOPIC);

  if (!topicDirs.length) {
    console.log(ONLY_TOPIC ? `[assets] Topic not found: ${ONLY_TOPIC}` : "[assets] No topics found.");
    return;
  }

  let imgGenerated = 0, imgSkipped = 0, imgErrors = 0;
  let diagAdded    = 0, diagSkipped = 0;

  for (const topicSlug of topicDirs) {
    const topicDir    = path.join(COURSES_DIR, topicSlug);
    const topicOutDir = path.join(OUT_DIR, topicSlug);
    fs.mkdirSync(topicOutDir, { recursive: true });

    const courseFiles = fs.readdirSync(topicDir)
      .filter((f) => /^course-\d{3}\.md$/.test(f))
      .filter((f) => !ONLY_COURSE || f === `${ONLY_COURSE}.md`)
      .sort();

    for (const cf of courseFiles) {
      const slug     = cf.replace(".md", "");
      const mdPath   = path.join(topicDir, cf);
      const imgPath  = path.join(topicOutDir, `${slug}-hero.jpg`);

      let raw;
      try { raw = fs.readFileSync(mdPath, "utf8"); }
      catch { console.warn(`[assets] Cannot read ${cf}, skipping`); continue; }

      const fm         = parseFrontmatter(raw);
      const title      = fm.title || slug;
      const topicLabel = fm.topic_label || topicSlug.replace(/-/g, " ");
      const sample     = contentSample(raw, 200);
      const hasDiagram = raw.includes("<!-- auto-diagram -->");

      // ── Image ──────────────────────────────────────────────────────────────
      if (!SKIP_IMAGES && (!fs.existsSync(imgPath) || FORCE)) {
        try {
          console.log(`[assets] Image: ${topicSlug}/${slug}`);
          const prompt = await buildImagePrompt(title, topicLabel, sample);
          console.log(`[assets]   prompt: ${prompt.slice(0, 80)}…`);
          await sleep(800);

          const imgBuf = await generateImage(prompt);
          fs.writeFileSync(imgPath, imgBuf);
          console.log(`[assets]   ✓ ${path.relative(ROOT, imgPath)}`);
          imgGenerated++;

          // Brief pause — Pollinations has no rate limit; NVIDIA NIM is ~40 req/min
          await sleep(1500);
        } catch (e) {
          console.error(`[assets]   ✗ Image error: ${e.message}`);
          imgErrors++;
          await sleep(1000);
        }
      } else if (fs.existsSync(imgPath)) {
        imgSkipped++;
      }

      // ── Diagram ────────────────────────────────────────────────────────────
      if (!SKIP_DIAG && !hasDiagram) {
        try {
          console.log(`[assets] Diagram check: ${topicSlug}/${slug}`);
          await sleep(600);
          const diagram = await tryDiagram(title, sample);
          if (diagram) {
            const updated = raw.trimEnd() + `\n\n<!-- auto-diagram -->\n${diagram}\n`;
            fs.writeFileSync(mdPath, updated, "utf8");
            console.log(`[assets]   ✓ Diagram added to ${cf}`);
            diagAdded++;
          } else {
            console.log(`[assets]   → No diagram needed`);
            diagSkipped++;
          }
        } catch (e) {
          console.error(`[assets]   ✗ Diagram error: ${e.message}`);
        }
      }
    }
  }

  console.log("\n[assets] ─── Summary ──────────────────────────────────────");
  console.log(`  Images:   ${imgGenerated} generated, ${imgSkipped} already existed, ${imgErrors} errors`);
  console.log(`  Diagrams: ${diagAdded} added, ${diagSkipped} skipped (no diagram needed)`);
  console.log("[assets] Done.");
}

main().catch((e) => { console.error("[assets] Fatal:", e.message); process.exit(1); });
