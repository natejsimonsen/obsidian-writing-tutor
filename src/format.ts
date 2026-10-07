import type { Critique } from "./claude";

function oneLine(s: string): string {
  return s.replace(/\s*\n\s*/g, " ").trim();
}

/** Wrap each non-empty line in italics, keeping list markers and headings outside the emphasis. */
export function italicize(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      const m = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+|\s*#{1,6}\s+|\s*>\s*)(.*)$/);
      if (m) {
        return m[2].trim() ? `${m[1]}*${m[2].trim()}*` : m[1];
      }
      return `*${line.trim()}*`;
    })
    .join("\n");
}

export function formatCritique(c: Critique): string {
  const lines: string[] = [];
  lines.push(`> [!tip] Writing tutor · Grade: ${c.grade}`);
  if (c.summary) lines.push(`> ${oneLine(c.summary)}`);
  if (c.strengths.length) {
    lines.push(">");
    lines.push("> **What works**");
    for (const s of c.strengths) lines.push(`> - ${oneLine(s)}`);
  }
  if (c.improvements.length) {
    lines.push(">");
    lines.push("> **What could be better**");
    for (const s of c.improvements) lines.push(`> - ${oneLine(s)}`);
  }
  if (c.revised) {
    lines.push("");
    lines.push("**Revised draft**");
    lines.push("");
    lines.push(italicize(c.revised));
  }
  return lines.join("\n");
}
