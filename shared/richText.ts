// Shared helpers for `LibraryText.body` (and any other rich-text field that
// follows the same convention): newer content is HTML produced by the admin
// dashboard's TipTap editor, while older content is the original hand-authored
// plain-text markup (`**bold**`, `*italic*`, `==highlight==`, `![alt](url)`).
//
// `looksLikeHtml` is the single source of truth both apps use to decide which
// renderer/parser applies to a given body string — TipTap's `getHTML()`
// always starts with a block tag (`<p>`, `<h2>`, `<ul>`, …), which plain
// hand-typed verse text realistically never does.

export function looksLikeHtml(body: string): boolean {
  return body.trimStart().startsWith("<");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function legacyInlineToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const re = /(\*\*[^*]+\*\*|==[^=]+==|\*[^*\n]+\*)/g;
  return escaped.replace(re, (chunk) => {
    if (chunk.startsWith("**")) return `<strong>${chunk.slice(2, -2)}</strong>`;
    if (chunk.startsWith("==")) return `<mark>${chunk.slice(2, -2)}</mark>`;
    return `<em>${chunk.slice(1, -1)}</em>`;
  });
}

/**
 * Converts an old plain-text/marker body into equivalent HTML, so it can be
 * loaded into the TipTap editor and re-saved as HTML from then on. Idempotent
 * no-op is unnecessary here — callers should only invoke this when
 * `!looksLikeHtml(body)`.
 */
export function legacyBodyToHtml(body: string): string {
  const imgRe = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/;
  const blocks = body.split(/\n{2,}/);
  const html = blocks
    .map((raw) => {
      const trimmed = raw.trim();
      if (!trimmed) return "";
      const m = trimmed.match(imgRe);
      if (m) {
        const [, alt, url] = m;
        return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`;
      }
      const withBreaks = legacyInlineToHtml(trimmed).replace(/\n/g, "<br>");
      return `<p>${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");
  return html || "<p></p>";
}
