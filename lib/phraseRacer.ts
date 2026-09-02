import { splitExampleLines } from "@/lib/examples"
import type { Phrase } from "@/lib/types"

export interface RacerQuestion {
  sentence: string
  answer: string[]
  fullSentence: string
}

// Turns a phrase + its example sentence into a fill-in-the-blank question by
// locating the phrase's own text inside the example (case-insensitively,
// since ~1/3 of real rows only match that way) and blanking it out. Real
// data isn't perfectly clean — inflected forms ("intensify" vs.
// "intensified") or trailing punctuation baked into the phrase field can
// make the phrase simply not appear in its example — those phrases are
// skipped (return null) rather than guessed at.
export function buildRacerQuestion(phrase: Phrase): RacerQuestion | null {
  const example = splitExampleLines(phrase.example)[0]
  if (!example) return null

  const needle = phrase.phrase.trim().replace(/[.?!]+$/, "")
  if (!needle) return null

  const idx = example.toLowerCase().indexOf(needle.toLowerCase())
  if (idx === -1) return null

  const matched = example.slice(idx, idx + needle.length)
  const before = example.slice(0, idx).trim()
  const after = example.slice(idx + needle.length).trim()

  const answer = matched.split(/\s+/).filter(Boolean)
  if (answer.length === 0) return null

  const blanks = answer.map(() => "_").join(" ")
  const sentence = [before, blanks, after].filter(Boolean).join(" ")

  return { sentence, answer, fullSentence: example }
}

export function buildRacerDeck(phrases: Phrase[]): RacerQuestion[] {
  const deck: RacerQuestion[] = []
  for (const phrase of phrases) {
    const question = buildRacerQuestion(phrase)
    if (question) deck.push(question)
  }
  return deck
}
