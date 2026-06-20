"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchPronunciation } from "@/lib/dictionary"
import { cn } from "@/lib/utils"

/**
 * Shows the IPA transcription under a phrase.
 * - If `initialIpa` (from the DB) exists → show it, no network call.
 * - Otherwise fetch from the free Dictionary API, show it, and backfill the DB
 *   via the set_phrase_ipa RPC so future loads read it straight from the DB.
 */
export function Ipa({
  phraseId,
  text,
  initialIpa,
  className,
}: {
  phraseId: string | number
  text: string
  initialIpa?: string | null
  className?: string
}) {
  const [ipa, setIpa] = useState<string | null>(initialIpa ?? null)

  useEffect(() => {
    if (initialIpa) return // DB already has it → no API call
    let cancelled = false
    fetchPronunciation(text).then(async ({ ipa: fetched }) => {
      if (cancelled || !fetched) return
      setIpa(fetched)
      // Backfill the cache (RLS-safe; only writes when currently empty).
      try {
        const supabase = createClient()
        await supabase.rpc("set_phrase_ipa", {
          p_id: Number(phraseId),
          p_ipa: fetched,
        })
      } catch {
        /* caching is best-effort */
      }
    })
    return () => {
      cancelled = true
    }
  }, [text, initialIpa, phraseId])

  if (!ipa) return null
  return (
    <span className={cn("font-mono text-xs text-muted-foreground", className)}>
      {ipa}
    </span>
  )
}
