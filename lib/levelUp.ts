import { createClient } from "@/lib/supabase/client"
import { getMasteryProgress, type MasteryLevelDef } from "@/lib/mastery"

// Word Mastery level is derived from the account-wide count of phrases
// marked "learned" (across every category, not just the one the user
// happens to be in). Several independent client components can flip a
// phrase to/from "learned" — Flashcard, Quiz, the phrase list, the phrase
// detail page — with no shared parent between them, so the running count
// lives at module scope (same reasoning as the shared AudioContext in
// lib/sounds.ts) instead of in React state.
let cachedUserId: string | null = null
let cachedCount: number | null = null

async function loadLearnedCount(userId: string): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "learned")
  return count ?? 0
}

async function computeLevelUp(
  userId: string,
  wasLearned: boolean,
  isLearned: boolean
): Promise<MasteryLevelDef | null> {
  if (wasLearned === isLearned) return null
  if (cachedUserId !== userId || cachedCount === null) {
    cachedUserId = userId
    cachedCount = await loadLearnedCount(userId)
  }
  const prevCount = cachedCount
  const nextCount = Math.max(0, prevCount + (isLearned ? 1 : -1))
  cachedCount = nextCount
  if (nextCount <= prevCount) return null // only celebrate increases

  const prevLevel = getMasteryProgress(prevCount).current
  const nextLevel = getMasteryProgress(nextCount).current
  return nextLevel.level > prevLevel.level ? nextLevel : null
}

// Serializes calls so two near-simultaneous status changes (e.g. rapid
// clicks) always see each other's effect on the running count instead of
// racing on the same stale `cachedCount` read.
let chain: Promise<unknown> = Promise.resolve()

/**
 * Call right after a phrase's "learned" status is saved. `wasLearned` /
 * `isLearned` describe that one phrase's status before/after the change.
 * Resolves to the newly-reached level when this change pushed the
 * account's total learned count across a Word Mastery threshold,
 * otherwise null.
 */
export function checkLevelUp(
  userId: string,
  wasLearned: boolean,
  isLearned: boolean
): Promise<MasteryLevelDef | null> {
  const result = chain.then(() => computeLevelUp(userId, wasLearned, isLearned))
  chain = result.catch(() => null)
  return result
}
