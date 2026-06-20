"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2 } from "lucide-react"
import { fetchPronunciation } from "@/lib/dictionary"
import { speakText } from "@/lib/speak"
import { createClient } from "@/lib/supabase/client"

/**
 * Shows IPA next to a phrase and a pronounce button.
 * IPA priority: the stored value (from DB) → auto-fetched from the free
 * Dictionary API. Audio priority: real Dictionary audio → Web Speech fallback.
 */
export function PronunciationControls({
  phraseId,
  text,
  initialIpa,
}: {
  phraseId: string | number
  text: string
  initialIpa?: string | null
}) {
  const [ipa, setIpa] = useState<string | null>(initialIpa ?? null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Fetch for the real audio, and for IPA if we don't already have one.
    fetchPronunciation(text).then(async (res) => {
      if (cancelled) return
      audioUrlRef.current = res.audioUrl
      if (!initialIpa && res.ipa) {
        setIpa(res.ipa)
        // Backfill the cache so future loads read it from the DB.
        try {
          const supabase = createClient()
          await supabase.rpc("set_phrase_ipa", {
            p_id: Number(phraseId),
            p_ipa: res.ipa,
          })
        } catch {
          /* best-effort */
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [text, initialIpa, phraseId])

  function speak() {
    if (audioUrlRef.current) {
      const audio = new Audio(audioUrlRef.current)
      audio.volume = 0.85
      void audio.play().catch(() => speakText(text))
      return
    }
    speakText(text)
  }

  return (
    <div className="mt-2 flex items-center gap-3">
      <button
        type="button"
        onClick={speak}
        aria-label={`Pronounce "${text}"`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-[#22c55e]/40 hover:text-[#22c55e]"
      >
        <Volume2 className="size-4" />
        Listen
      </button>
      {ipa && (
        <span className="font-mono text-sm text-muted-foreground">{ipa}</span>
      )}
    </div>
  )
}
