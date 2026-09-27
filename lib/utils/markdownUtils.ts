/**
 * Strips markdown syntax, tables, code blocks, links, and formatting
 * to produce clean plain text suitable for preview snippets in chat cards.
 */
export function stripMarkdown(raw?: string | null): string {
  if (!raw) return "";

  let text = String(raw);

  // 1. Code blocks: ```lang ... ``` -> content
  text = text.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, "$1");

  // 2. Headings (# Heading -> Heading)
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");

  // 3. Blockquotes (> quote -> quote)
  text = text.replace(/^\s{0,3}>\s?/gm, "");

  // 4. Horizontal rules (---, ***, ___)
  text = text.replace(/^\s*([-*_]){3,}\s*$/gm, "");

  // 5. Clean table rows:
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip table header divider line (e.g. |---|---| or |:---|---:| or | --- | --- |)
    if (/^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed)) {
      continue;
    }

    // Table rows with pipes
    if (trimmed.startsWith("|") || trimmed.endsWith("|") || (trimmed.includes("|") && trimmed.split("|").length >= 3)) {
      const cells = trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cells.length > 0) {
        cleanedLines.push(cells.join(": "));
        continue;
      }
    }

    cleanedLines.push(line);
  }

  text = cleanedLines.join("\n");

  // 6. Inline code: `code` -> code
  text = text.replace(/`([^`]+)`/g, "$1");

  // 7. Images: ![alt](url) -> alt or [Photo]
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => alt ? alt.trim() : "Photo");

  // 8. Links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 9. Bold, Italic, Strikethrough
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/~~(.*?)~~/g, "$1");

  // 10. List bullets: - item, * item, 1. item -> item
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // 11. Normalize all whitespace/newlines into a single line readable snippet
  text = text
    .replace(/\r?\n+/g, " · ")
    .replace(/\s{2,}/g, " ")
    .replace(/( · )+/g, " · ")
    .trim();

  // Strip leading or trailing separators
  text = text.replace(/^·\s*/, "").replace(/\s*·$/, "").trim();

  return text;
}
