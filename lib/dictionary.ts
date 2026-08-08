// Free Dictionary API (https://dictionaryapi.dev) — no key required.
// Returns IPA text and a real audio URL when available. Works best for single
// words; multi-word phrases often return 200 with no phonetic.

export interface DictionaryResult {
  ipa: string | null
  audioUrl: string | null
}

// A phrase list can mount dozens of <Ipa> instances at once, each wanting to
// look up its own phrase. Without coordination that's dozens of simultaneous
// requests to a free, rate-limited third-party API. Two guards below fix that:
// a per-text cache (dedupe repeat/concurrent lookups of the same phrase) and
// a small concurrency queue (only a few requests in flight at a time).

const cache = new Map<string, Promise<DictionaryResult>>()

const MAX_CONCURRENT = 4
let inFlight = 0
const queue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++
    return Promise.resolve()
  }
  return new Promise((resolve) => queue.push(resolve))
}

function releaseSlot() {
  const next = queue.shift()
  if (next) next()
  else inFlight--
}

export async function fetchPronunciation(
  text: string
): Promise<DictionaryResult> {
  const key = text.trim().toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const promise = fetchPronunciationUncached(key)
  cache.set(key, promise)
  return promise
}

async function fetchPronunciationUncached(
  text: string
): Promise<DictionaryResult> {
  await acquireSlot()
  try {
    return await fetchPronunciationNow(text)
  } finally {
    releaseSlot()
  }
}

async function fetchPronunciationNow(
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
