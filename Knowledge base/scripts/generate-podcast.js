#!/usr/bin/env node
/**
 * generate-podcast.js — Generate a 2-speaker podcast MP3 for each course.
 *
 * Pipeline:
 *   1. Read course markdown
 *   2. OpenRouter AI → dialogue script (ALEX + SAM, ~1100 words)
 *      Saved to content/courses/{topic}/audio/{course}-podcast-script.txt
 *   3. Python scripts/transcribe/generate_audio.py → edge-tts → MP3
 *      Saved to public/course-audio/{topic}/{course}-podcast.mp3
 *
 * Usage:
 *   node scripts/generate-podcast.js
 *   node scripts/generate-podcast.js --topic ai-agents
 *   node scripts/generate-podcast.js --topic ai-agents --course course-001
 *   node scripts/generate-podcast.js --force             (regenerate existing)
 *   node scripts/generate-podcast.js --script-only       (skip TTS, generate scripts only)
 *
 * Requirements:
 *   pip install edge-tts
 *   ffmpeg on PATH (already present via yt-dlp or standalone install)
 *
 * Upgrade path to Orpheus TTS (high quality, GPU-only):
 *   1. ollama pull legraphista/Orpheus:3b-ft-q4_k_m
 *   2. Run Orpheus-FastAPI: https://github.com/Lex-au/Orpheus-FastAPI
 *   3. Set ORPHEUS_API_URL=http://localhost:5005 in .env
 *   generate_audio.py will automatically use Orpheus when the var is set.
 */
require("dotenv").config();
const fs    = require("fs");
const path  = require("path");
const { execFileSync } = require("child_process");
const { aiGenerate }   = require("./lib/ai-client");

const ROOT        = process.cwd();
const COURSES_DIR = path.join(ROOT, "content", "courses");
const AUDIO_OUT   = path.join(ROOT, "public", "course-audio");

// ── CLI flags ────────────────────────────────────────────────────────────────
const argv        = process.argv.slice(2);
const ONLY_TOPIC  = argv.includes("--topic")  ? argv[argv.indexOf("--topic")  + 1] : null;
const ONLY_COURSE = argv.includes("--course") ? argv[argv.indexOf("--course") + 1] : null;
const FORCE       = argv.includes("--force");
const SCRIPT_ONLY = argv.includes("--script-only");

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

function stripMarkdown(text) {
  return text
    .replace(/^---[\s\S]*?---\n?/, "")       // frontmatter
    .replace(/<!--[\s\S]*?-->/g, "")          // HTML comments
    .replace(/```[\s\S]*?```/g, "")           // code blocks
    .replace(/#+\s+/g, "")                    // headings
    .replace(/[*_`~]+/g, "")                  // emphasis chars
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // links
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── AI helper (uses ai-client.js: OpenRouter → NVIDIA NIM → Ollama) ─────────
async function orChat(systemPrompt, userMsg, maxTokens = 1400) {
  return aiGenerate(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg }],
    { maxTokens, label: "podcast" },
  );
}

// ── Podcast script generation ────────────────────────────────────────────────
async function generateScript(title, topicLabel, content) {
  const system = `You are a scriptwriter for "KnowledgeBase Daily", an educational podcast.
Create a lively, 2-host dialogue between ALEX (the explainer) and SAM (the curious questioner).

Format — alternate lines, always starting with [ALEX]:
[ALEX]: <text>
[SAM]: <text>
[ALEX]: <text>
...

Rules:
- Aim for 10-14 exchanges total (~950-1150 words)
- ALEX opens with a punchy hook and closes with a key takeaway
- SAM asks clarifying questions, shares relatable analogies, and challenges assumptions
- No filler phrases ("absolutely!", "great question!") — keep it sharp and natural
- Do NOT include stage directions, timestamps, or anything outside the [ALEX]/[SAM] format
- Cover the main ideas in the course content; don't just summarise — spark curiosity
- Output ONLY the dialogue. Start immediately with [ALEX]:`;

  const userMsg = `Course: ${title}\nTopic: ${topicLabel}\n\n---\n${content.slice(0, 3500)}`;
  return orChat(system, userMsg, 1600);
}

// ── Audio generation (Python) ─────────────────────────────────────────────────
function generateAudio(scriptFile, outputMp3) {
  const pyScript = path.join(ROOT, "scripts", "transcribe", "generate_audio.py");
  try {
    execFileSync("python", [pyScript, scriptFile, outputMp3], {
      stdio: ["inherit", "inherit", "inherit"],
      cwd:   ROOT,
    });
  } catch (e) {
    // Try python3 as fallback
    execFileSync("python3", [pyScript, scriptFile, outputMp3], {
      stdio: ["inherit", "inherit", "inherit"],
      cwd:   ROOT,
    });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {

  if (!fs.existsSync(COURSES_DIR)) {
    console.error("[podcast] content/courses/ not found — run the pipeline first.");
    process.exit(1);
  }

  const topicDirs = fs.readdirSync(COURSES_DIR)
    .filter((n) => fs.statSync(path.join(COURSES_DIR, n)).isDirectory())
    .filter((n) => !ONLY_TOPIC || n === ONLY_TOPIC)
    .sort();

  if (!topicDirs.length) {
    console.log(ONLY_TOPIC ? `[podcast] Topic not found: ${ONLY_TOPIC}` : "[podcast] No topics found.");
    return;
  }

  let scriptsGen = 0, audiosGen = 0, skipped = 0, errors = 0;

  for (const topicSlug of topicDirs) {
    const topicDir     = path.join(COURSES_DIR, topicSlug);
    const audioDir     = path.join(topicDir, "audio");
    const audioOutDir  = path.join(AUDIO_OUT, topicSlug);

    const courseFiles = fs.readdirSync(topicDir)
      .filter((f) => /^course-\d{3}\.md$/.test(f))
      .filter((f) => !ONLY_COURSE || f === `${ONLY_COURSE}.md`)
      .sort();

    for (const cf of courseFiles) {
      const slug       = cf.replace(".md", "");
      const mdPath     = path.join(topicDir, cf);
      const scriptPath = path.join(audioDir, `${slug}-podcast-script.txt`);
      const mp3Path    = path.join(audioOutDir, `${slug}-podcast.mp3`);

      // Skip if audio already exists and not forcing
      if (!FORCE && fs.existsSync(mp3Path)) {
        skipped++;
        continue;
      }

      let raw;
      try { raw = fs.readFileSync(mdPath, "utf8"); }
      catch { console.warn(`[podcast] Cannot read ${cf}`); continue; }

      const fm         = parseFrontmatter(raw);
      const title      = fm.title || slug;
      const topicLabel = fm.topic_label || topicSlug.replace(/-/g, " ");
      const content    = stripMarkdown(raw);

      // ── Generate dialogue script ──────────────────────────────────────────
      let scriptText = null;
      if (!FORCE && fs.existsSync(scriptPath)) {
        console.log(`[podcast] Script exists, reusing: ${slug}`);
        scriptText = fs.readFileSync(scriptPath, "utf8");
      } else {
        try {
          console.log(`[podcast] Generating script: ${topicSlug}/${slug}`);
          scriptText = await generateScript(title, topicLabel, content);
          fs.mkdirSync(audioDir, { recursive: true });
          fs.writeFileSync(scriptPath, scriptText, "utf8");
          console.log(`[podcast]   ✓ Script saved (${scriptText.split("\n").length} lines)`);
          scriptsGen++;
          // Rate limit: 1.5s between OpenRouter calls
          await sleep(1500);
        } catch (e) {
          console.error(`[podcast]   ✗ Script error: ${e.message}`);
          errors++;
          continue;
        }
      }

      if (SCRIPT_ONLY) continue;

      // ── Generate audio ────────────────────────────────────────────────────
      try {
        console.log(`[podcast] Generating audio: ${topicSlug}/${slug}`);
        fs.mkdirSync(audioOutDir, { recursive: true });
        generateAudio(scriptPath, mp3Path);
        const stat = fs.statSync(mp3Path);
        const kb   = (stat.size / 1024).toFixed(0);
        console.log(`[podcast]   ✓ Audio saved ${kb} KB → ${path.relative(ROOT, mp3Path)}`);
        audiosGen++;
      } catch (e) {
        console.error(`[podcast]   ✗ Audio error: ${e.message}`);
        errors++;
      }
    }
  }

  console.log("\n[podcast] ─── Summary ─────────────────────────────────────────");
  console.log(`  Scripts:  ${scriptsGen} generated`);
  console.log(`  Audios:   ${audiosGen} generated, ${skipped} already existed, ${errors} errors`);
  console.log("[podcast] Done.");
}

main().catch((e) => { console.error("[podcast] Fatal:", e.message); process.exit(1); });
