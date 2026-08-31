/** Normalizes visual variants while leaving the original label untouched for UI display. */
export function normalizeQuestionLabel(input?: string): string {
  if (!input) return "";

  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/^question\s*/i, "")
    .replace(/^q\s*[.:#-]?\s*/i, "")
    .replace(/[()[\]{}._\-:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const match = cleaned.match(/^(\d+)\s*(.*)$/);
  if (!match) return cleaned.replace(/\s+/g, "");

  const number = match[1];
  const parts = match[2]
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => /^[a-z]+$/.test(part));

  return parts.reduce((label, part) => `${label}(${part})`, number);
}

export function questionLabelsMatch(a?: string, b?: string): boolean {
  const left = normalizeQuestionLabel(a);
  const right = normalizeQuestionLabel(b);
  return Boolean(left && right && left === right);
}
