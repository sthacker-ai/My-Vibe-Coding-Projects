import fs from "fs";
import path from "path";
import Link from "next/link";
import matter from "gray-matter";
import { markdownToHtml } from "../../../lib/markdown";
import { notFound } from "next/navigation";
import TweetEmbed from "../../../components/TweetEmbed";

const ROOT        = process.cwd();
const COURSES_DIR = path.join(ROOT, "content", "courses");
const RAW_DIR     = path.join(ROOT, "data", "raw", "tweets");

interface Props {
  params: Promise<{ topic: string; course: string }>;
}

export async function generateStaticParams() {
  if (!fs.existsSync(COURSES_DIR)) return [];
  const params: { topic: string; course: string }[] = [];
  for (const topic of fs.readdirSync(COURSES_DIR)) {
    const dir = path.join(COURSES_DIR, topic);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/^course-\d{3}\.md$/.test(f)) {
        params.push({ topic, course: f.replace(".md", "") });
      }
    }
  }
  return params;
}

export default async function CoursePage({ params }: Props) {
  const { topic, course } = await params;
  const filePath = path.join(COURSES_DIR, topic, `${course}.md`);
  if (!fs.existsSync(filePath)) notFound();

  const raw = fs.readFileSync(filePath, "utf8");
  let frontmatter: Record<string, string> = {};
  let content = raw;
  try {
    const parsed = matter(raw);
    frontmatter = parsed.data as Record<string, string>;
    content = parsed.content;
  } catch {
    // use raw
  }

  const html = markdownToHtml(content);

  // Read extraction type from raw extracted JSON
  const tweetId   = (frontmatter.source_id ?? frontmatter.tweet_id ?? "") as string;
  const tweetUrl  = frontmatter.tweet_url ?? "";
  let extractionType = "plain_tweet";
  if (tweetId) {
    try {
      const extPath = path.join(RAW_DIR, `${tweetId}-extracted.json`);
      if (fs.existsSync(extPath)) {
        const ext = JSON.parse(fs.readFileSync(extPath, "utf8"));
        extractionType = ext.extraction_type || "plain_tweet";
      }
    } catch { /* ignore */ }
  }
  const isVideo   = extractionType === "x_video";
  const isArticle = extractionType === "x_article";

  // Find adjacent courses in the same topic
  const dir = path.join(COURSES_DIR, topic);
  const allCourseFiles = fs.readdirSync(dir).filter((f) => /^course-\d{3}\.md$/.test(f)).sort();
  const idx = allCourseFiles.indexOf(`${course}.md`);
  const prevCourse = idx > 0 ? allCourseFiles[idx - 1].replace(".md", "") : null;
  const nextCourse = idx < allCourseFiles.length - 1 ? allCourseFiles[idx + 1].replace(".md", "") : null;

  // Build course list with titles for sidebar
  const allCourses = allCourseFiles.map((cf) => {
    const cSlug = cf.replace(".md", "");
    let cTitle = `Course ${cSlug.replace("course-", "")}`;
    try {
      const cRaw = fs.readFileSync(path.join(dir, cf), "utf8");
      const cParsed = matter(cRaw);
      if (cParsed.data.title) cTitle = String(cParsed.data.title);
    } catch { /* use fallback */ }
    return { slug: cSlug, title: cTitle };
  });

  const topicLabel = (frontmatter.topic_label || topic.replace(/-/g, " ")).replace(/\b\w/g, (c) => c.toUpperCase());

  // Check for generated hero image and podcast audio
  const heroImgPath  = path.join(ROOT, "public", "course-assets", topic, `${course}-hero.jpg`);
  const hasHeroImage = fs.existsSync(heroImgPath);
  const podcastMp3Path = path.join(ROOT, "public", "course-audio", topic, `${course}-podcast.mp3`);
  const hasPodcast   = fs.existsSync(podcastMp3Path);
  const scriptTxtPath = path.join(COURSES_DIR, topic, "audio", `${course}-podcast-script.txt`);
  const hasScript    = fs.existsSync(scriptTxtPath);

  return (
    <main className="kb-shell">
      <aside className="kb-sidebar" aria-label="KnowledgeBase navigation">
        <div className="kb-brand">
          <div className="kb-brand-mark" aria-hidden="true" />
          <div>
            <p className="kb-brand-name">KnowledgeBase</p>
            <p className="kb-brand-sub">Local-first learning system</p>
          </div>
        </div>
        <p className="nav-section-label">Menu</p>
        <Link href="/"           className="kb-nav-link"><span className="kb-nav-icon" />Overview</Link>
        <Link href="/sources"    className="kb-nav-link"><span className="kb-nav-icon" />Source Inbox</Link>
        <Link href="/courseware" className="kb-nav-link active" aria-current="page"><span className="kb-nav-icon" />Courseware</Link>
        <Link href="/wiki"       className="kb-nav-link"><span className="kb-nav-icon" />Wiki Notes</Link>
        <Link href="/graph"      className="kb-nav-link"><span className="kb-nav-icon" />Knowledge Graph</Link>
        <Link href="/runs"       className="kb-nav-link"><span className="kb-nav-icon" />Run History</Link>
        <Link href="/tokens"     className="kb-nav-link"><span className="kb-nav-icon" />Token Usage</Link>
        <div className="sidebar-bottom">
          <Link href="/admin" className="kb-nav-link"><span className="kb-nav-icon" />Admin</Link>
        </div>
      </aside>

      <section className="kb-workspace">
        {/* Breadcrumb */}
        <div style={{ padding: "14px 0 8px", fontSize: "0.8rem", color: "var(--muted)" }}>
          <Link href="/courseware" style={{ color: "var(--brand)", textDecoration: "none" }}>Courseware</Link>
          {" / "}
          <Link href={`/courseware/${topic}`} style={{ color: "var(--brand)", textDecoration: "none" }}>{topicLabel}</Link>
          {" / "}
          <span>{course}</span>
        </div>

        {/* Course content */}
        <article className="kb-source-panel kb-article">
          {/* Hero image (generated by generate-course-assets.js) */}
          {hasHeroImage && (
            <img
              src={`/course-assets/${topic}/${course}-hero.jpg`}
              alt={frontmatter.title || course}
              style={{
                width: "100%", height: "220px",
                objectFit: "cover", borderRadius: "10px",
                marginBottom: "20px", display: "block",
              }}
            />
          )}
        {/* Source card */}
          {tweetUrl && (
            <div style={{
              background: isVideo ? "var(--amber-dim, #fffbeb)" : isArticle ? "var(--blue-dim, #eff6ff)" : "var(--green-dim, #f0fdf4)",
              border: `1px solid ${isVideo ? "#f59e0b44" : isArticle ? "#3b82f644" : "#22c55e44"}`,
              borderRadius: "10px",
              padding: "14px 18px",
              marginBottom: "20px",
              display: "flex",
              flexWrap: "wrap" as const,
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "99px",
                background: isVideo ? "#f59e0b" : isArticle ? "#3b82f6" : "#22c55e",
                color: "#fff",
                letterSpacing: "0.04em",
                textTransform: "uppercase" as const,
              }}>
                {isVideo ? "Video" : isArticle ? "Article" : "Tweet"}
              </span>
              {frontmatter.source_handle && (
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{frontmatter.source_handle}</span>
              )}
              <span style={{ flex: 1 }} />
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: isVideo ? "#f59e0b" : "var(--brand)",
                  color: "#fff",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  textDecoration: "none",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {isVideo ? "Watch on X →" : "View Source →"}
              </a>
            </div>
          )}

          {/* Twitter embed for video/article sources */}
          {tweetUrl && (isVideo || isArticle) && (
            <div style={{ marginBottom: "24px" }}>
              <TweetEmbed tweetUrl={tweetUrl} />
            </div>
          )}

          {isVideo && (
            <div style={{
              background: "#fffbeb",
              border: "1px solid #f59e0b44",
              borderRadius: "8px",
              padding: "10px 16px",
              marginBottom: "16px",
              fontSize: "0.82rem",
              color: "#92400e",
            }}>
              <strong>Note:</strong> This course was generated from the tweet text and description &mdash; not from a full video transcript. To watch the actual video, use the button above.
            </div>
          )}

          <div
            className="md-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>

        {/* Podcast audio player (generated by generate-podcast.js) */}
        {hasPodcast && (
          <div className="kb-source-panel" style={{
            padding: "16px 20px",
            marginTop: "4px",
            background: "var(--surface)",
          }}>
            <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: "0 0 10px" }}>
              🎙 Podcast Version
            </p>
            <audio
              controls
              style={{ width: "100%" }}
            >
              <source src={`/course-audio/${topic}/${course}-podcast.mp3`} type="audio/mpeg" />
              Your browser does not support audio playback.
            </audio>
            {hasScript && (
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "8px", marginBottom: 0 }}>
                2-host dialogue — ALEX &amp; SAM discuss this course.
              </p>
            )}
          </div>
        )}

        {/* Prev / Next navigation */}
        <div style={{ display: "flex", gap: "12px", margin: "16px 0" }}>
          {prevCourse ? (
            <Link href={`/courseware/${topic}/${prevCourse}`} className="btn-outline" style={{ textDecoration: "none" }}>
              ← Previous
            </Link>
          ) : <div />}
          {nextCourse ? (
            <Link href={`/courseware/${topic}/${nextCourse}`} className="btn-primary" style={{ textDecoration: "none" }}>
              Next →
            </Link>
          ) : null}
        </div>
      </section>

      <aside className="kb-right" aria-label="Course info">
        <div>
          <h2 className="kb-right-title">{topicLabel}</h2>
          <p className="kb-right-sub">Course {course.replace("course-", "")}</p>
          <div className="kb-widget" style={{ marginTop: "12px" }}>
            {frontmatter.source_handle && (
              <div className="vault-row"><span>Author</span><strong>{frontmatter.source_handle}</strong></div>
            )}
            <div className="vault-row"><span>Type</span><strong style={{ textTransform: "capitalize" }}>{extractionType.replace("_", " ")}</strong></div>
            {frontmatter.generated_at && (
              <div className="vault-row"><span>Generated</span><strong>{new Date(frontmatter.generated_at).toLocaleDateString("en-IN")}</strong></div>
            )}
          </div>
        </div>
        <div>
          <p className="kb-widget-title">More in {topicLabel}</p>
          <div className="kb-widget">
            {allCourses.map((c) => {
              const isActive = c.slug === course;
              return (
                <div key={c.slug} className="vault-row" style={{ background: isActive ? "var(--purple-dim)" : undefined, borderRadius: "4px", padding: "2px 6px" }}>
                  <Link href={`/courseware/${topic}/${c.slug}`} style={{ color: isActive ? "var(--brand)" : "inherit", textDecoration: "none", fontSize: "0.78rem" }}>
                    {c.title.length > 52 ? c.title.slice(0, 50) + "\u2026" : c.title}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
        {frontmatter.topic_slug && (
          <div>
            <Link href={`/wiki/${frontmatter.topic_slug}`} className="btn-outline" style={{ textDecoration: "none", display: "block", textAlign: "center", marginTop: "8px" }}>
              View Topic Wiki
            </Link>
          </div>
        )}
      </aside>
    </main>
  );
}
