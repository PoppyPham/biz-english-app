// Free Dictionary API (https://dictionaryapi.dev) — no key required.
// Returns IPA text and a real audio URL when available. Works best for single
// words; multi-word phrases often return 200 with no phonetic.

export interface DictionaryResult {
  ipa: string | null
  audioUrl: string | null
}

export async function fetchPronunciation(
  text: string
): Promise<DictionaryResult> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
        text.trim()
      )}`
    )
    if (!res.ok) return { ipa: null, audioUrl: null }
    const data = await res.json()
    const entry = Array.isArray(data) ? data[0] : null
    if (!entry) return { ipa: null, audioUrl: null }

    const phonetics: Array<{ text?: string; audio?: string }> =
      entry.phonetics ?? []
    const ipa: string | null =
      entry.phonetic ||
      phonetics.map((p) => p.text).find((t): t is string => !!t) ||
      null

    let audioUrl: string | null =
      phonetics.map((p) => p.audio).find((a): a is string => !!a) || null
    // The API sometimes returns protocol-relative URLs.
    if (audioUrl && audioUrl.startsWith("//")) audioUrl = `https:${audioUrl}`

    return { ipa, audioUrl }
  } catch {
    return { ipa: null, audioUrl: null }
  }
}
