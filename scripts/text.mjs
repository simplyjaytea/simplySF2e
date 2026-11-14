/**
 * Pure string helpers shared across every pipeline. No Foundry globals are
 * used, so these helpers also run directly in Node regression checks.
 */

/** "Ghost Touch" -> "ghost-touch". */
export const slugify = (value) =>
  String(value ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** "ghost touch" -> "Ghost Touch" (per-word, leaves the rest alone). */
export function capitalized(text) {
  return String(text).split(" ").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

/**
 * Escape plain text for HTML content and quoted attributes. Every
 * description/notes/chat-message field in this module funnels through here —
 * a generated name or ability description is untrusted input, and it lands in
 * `system.description.value`, actor notes, and macro chat content, all of
 * which Foundry renders as HTML.
 */
export function esc(text) {
  const value = String(text ?? "");
  return value.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Pure: breaks Foundry enricher syntax in AI prose without changing what a
 * reader sees. Foundry enriches the decoded text, so `@UUID[...]{...}`,
 * `@Check[...]`, `@Damage[...]`, `@Template[...]`, `@Localize[...]`, unknown
 * `@Word[`, `&Word[` and `[[/r ...]]` would go live. A zero-width space (U+200B)
 * after `@` or `&` before a word and `[`, between `[[`, and between `]]` stops
 * the match. Brackets, `&` in "R&D" and `@` alone are not touched.
 */
export function inertProse(text) {
  return String(text ?? "")
    .replace(/([@&])(?=\w+\[)/g, "$1\u200B")
    .replace(/\[(?=\[)/g, "[\u200B")
    .replace(/\](?=\])/g, "]\u200B");
}

/** HTML-escaped AI text with enricher syntax made inert. Use for AI text in any enriched field. */
export const escAi = (text) => esc(inertProse(text));

/**
 * AI text made safe for inline syntax: removes the characters that open or
 * close Foundry enrichers and inline rolls ([ ] { } @ |) and collapses
 * whitespace. The result is still HTML-escaped with esc() by the caller.
 */
export function plainAiText(text) {
  return String(text ?? "").replace(/[\[\]{}@|]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Escape plain multi-paragraph AI text and wrap it in <p> tags (blank-line
 * separated). Returns "" for empty input so callers can drop the field.
 */
export const toHtml = (text) => {
  const inert = text ? inertProse(text) : "";
  return inert
    ? `<p>${inert.split(/\n{2,}/).map((p) => esc(p.trim())).filter(Boolean).join("</p><p>")}</p>`
    : "";
};

/**
 * Search words the AI offered for a catalog lookup (spell themes): lowercase,
 * trimmed, without duplicates, at most `max`. Anything that is not a short
 * string is dropped. They only rank real catalog entries; they never name one.
 */
export function searchKeywords(raw, max = 8) {
  const words = (Array.isArray(raw) ? raw : [])
    .filter((word) => typeof word === "string")
    .map((word) => word.toLowerCase().trim())
    .filter((word) => word && word.length <= 40);
  return [...new Set(words)].slice(0, max);
}

/**
 * Format a modifier with an explicit sign for display: 3 -> "+3", 0 -> "+0",
 * -2 -> "-2" (ASCII hyphen-minus). Display only: never feed the result back
 * into stats or actor data. Non-finite input returns "".
 */
export function signed(value) {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return "";
  return n < 0 ? `-${Math.abs(n)}` : `+${n}`;
}
