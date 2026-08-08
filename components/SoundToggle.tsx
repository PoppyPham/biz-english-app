"use client"

import { useEffect, useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { isSoundEnabled, setSoundEnabled, playFlip } from "@/lib/sounds"

/** Mute/unmute toggle for the synthesized game SFX (lib/sounds.ts). */
export function SoundToggle({ className }: { className?: string }) {
  // Starts true, corrected right after mount — avoids an SSR/client hydration mismatch.
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(isSoundEnabled())
  }, [])

  function toggle() {
    const next = !enabled
    setSoundEnabled(next)
    setEnabled(next)
    if (next) playFlip()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Mute sound effects" : "Unmute sound effects"}
      className={cn(
        "shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      {enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </button>
  )
}
