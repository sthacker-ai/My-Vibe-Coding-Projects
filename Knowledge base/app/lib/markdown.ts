/**
 * Minimal Markdown-to-HTML converter for knowledge base pages.
 * Handles the structured output produced by compile-course.js and update-topic-summary.js.
 */

export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" = "ul";

  function closeList() {
    if (inList) {
      out.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }
  }

  function renderInline(text: string): string {
    return text
      // Wikilinks [[Topic]] → internal links
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
        const slug = target.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        return `<a class="wikilink" href="/wiki/${slug}">${(label || target).trim()}</a>`;
      })
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        const escaped = codeLines
          .join("\n")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        out.push(`<pre class="kb-code"><code class="lang-${codeLang}">${escaped}</code></pre>`);
        inCode = false;
        codeLines = [];
        codeLang = "";
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push('<hr class="kb-hr">');
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) { closeList(); out.push(`<h1 class="md-h1">${renderInline(h1[1])}</h1>`); continue; }
    if (h2) { closeList(); out.push(`<h2 class="md-h2">${renderInline(h2[1])}</h2>`); continue; }
    if (h3) { closeList(); out.push(`<h3 class="md-h3">${renderInline(h3[1])}</h3>`); continue; }

    // Ordered list item
    const olItem = line.match(/^\d+\.\s+(.+)/);
    if (olItem) {
      if (!inList || listType !== "ol") {
        closeList();
        out.push("<ol class=\"md-ol\">");
        inList = true;
        listType = "ol";
      }
      out.push(`<li>${renderInline(olItem[1])}</li>`);
      continue;
    }

    // Unordered list item (-, *, •)
    const ulItem = line.match(/^[*\-•]\s+(.+)/);
    if (ulItem) {
      if (!inList || listType !== "ul") {
        closeList();
        out.push("<ul class=\"md-ul\">");
        inList = true;
        listType = "ul";
      }
      out.push(`<li>${renderInline(ulItem[1])}</li>`);
      continue;
    }

    // Blockquote
    const bq = line.match(/^>\s*(.*)/);
    if (bq) {
      closeList();
      out.push(`<blockquote class="md-bq">${renderInline(bq[1])}</blockquote>`);
      continue;
    }

    // Empty line → paragraph break
    if (line.trim() === "") {
      closeList();
      out.push('<div class="md-gap"></div>');
      continue;
    }

    // Normal paragraph text
    closeList();
    out.push(`<p class="md-p">${renderInline(line)}</p>`);
  }

  closeList();
  if (inCode && codeLines.length) {
    const escaped = codeLines.join("\n").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    out.push(`<pre class="kb-code"><code>${escaped}</code></pre>`);
  }

  return out.join("\n");
}
