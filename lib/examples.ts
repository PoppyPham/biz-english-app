// Example/translation text in the DB mixes a few bilingual formats:
//   - "English sentence.\n\nVietnamese sentence."  (blank-line separated)
//   - "English sentence.\nVietnamese sentence."    (single newline)
//   - "English sentence. (Vietnamese sentence.)"   (inline parenthetical, no newline)
// This splits any of those into one sentence per display line.

const NON_ASCII = /[^\x00-\x7F]/

export function splitExampleLines(text: string | null | undefined): string[] {
  if (!text) return []

  const rawLines = text
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  const out: string[] = []
  for (const line of rawLines) {
    // A trailing "(...)" whose content has non-ASCII (Vietnamese) chars is a
    // translation tacked on inline, with no newline to split on — separate
    // it onto its own line too.
    const m = line.match(/^(.*\S)\s\(([^()]+)\)\s*$/)
    if (m && NON_ASCII.test(m[2])) {
      if (m[1]) out.push(m[1])
      out.push(`(${m[2]})`)
    } else {
      out.push(line)
    }
  }
  return out
}
