"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2 } from "lucide-react"
import { fetchPronunciation } from "@/lib/dictionary"

/**
 * Shows IPA next to a phrase and a pronounce button.
 * IPA priority: the stored value (from DB) → auto-fetched from the free
 * Dictionary API. Audio priority: real Dictionary audio → Web Speech fallback.
 */
export function PronunciationControls({
  text,
  initialIpa,
}: {
  text: string
  initialIpa?: string | null
}) {
  const [ipa, setIpa] = useState<string | null>(initialIpa ?? null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Fetch for the real audio, and for IPA if we don't already have one.
    fetchPronunciation(text).then((res) => {
      if (cancelled) return
      audioUrlRef.current = res.audioUrl
      if (!initialIpa && res.ipa) setIpa(res.ipa)
    })
    return () => {
      cancelled = true
    }
  }, [text, initialIpa])

  function speak() {
    if (audioUrlRef.current) {
      void new Audio(audioUrlRef.current).play().catch(() => speakTTS())
      return
    }
    speakTTS()
  }

  function speakTTS() {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "en-US"
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
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
