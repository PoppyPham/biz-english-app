"use client"

import { Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { speakText } from "@/lib/speak"

/**
 * Lightweight pronounce button using the browser Web Speech API.
 * Works offline for any text (no network, no API key). Used in lists where
 * fetching real audio per item would be too heavy.
 */
export function SpeakButton({
  text,
  className,
  lang = "en-US",
}: {
  text: string
  className?: string
  lang?: string
}) {
  function speak(e: React.MouseEvent) {
    // Don't trigger parent links/cards.
    e.preventDefault()
    e.stopPropagation()
    speakText(text, lang)
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`Pronounce "${text}"`}
      className={cn(
        "shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-[#22c55e]",
        className
      )}
    >
      <Volume2 className="size-4" />
    </button>
  )
}
