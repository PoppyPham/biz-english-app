"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MasteryLevelDef } from "@/lib/mastery"

interface LevelUpPopupProps {
  level: MasteryLevelDef | null
  onClose: () => void
}

const AUTO_DISMISS_MS = 6000
const SPARKLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/**
 * Full-screen "you reached a new level" celebration — the biggest reward
 * moment in the app, so it gets its own overlay rather than the inline
 * toast/burst pattern used for a single card or quiz answer.
 */
export function LevelUpPopup({ level, onClose }: LevelUpPopupProps) {
  useEffect(() => {
    if (!level) return
    const id = setTimeout(onClose, AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [level, onClose])

  if (!level) return null
  const Icon = level.icon

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-1.5 rounded-3xl border border-primary/30 bg-card px-8 py-9 text-center shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className={cn(
            "absolute top-9 size-28 rounded-full animate-burst-ring",
            level.glow
          )}
        />
        <div
          className={cn(
            "relative flex size-20 items-center justify-center rounded-full",
            level.glow
          )}
        >
          <Icon className={cn("size-10", level.color)} />
        </div>
        {SPARKLE_ANGLES.map((deg) => (
          <span
            key={deg}
            className="absolute top-9 size-1.5 rounded-full bg-primary animate-sparkle-out"
            style={
              {
                "--sx": `${Math.round(Math.cos((deg * Math.PI) / 180) * 90)}px`,
                "--sy": `${Math.round(Math.sin((deg * Math.PI) / 180) * 90)}px`,
              } as React.CSSProperties
            }
          />
        ))}

        <p className="relative mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          🎉 Congratulations!
        </p>
        <p className="relative text-2xl font-extrabold">
          You reached Level {level.level}
        </p>
        <p className={cn("relative text-lg font-bold", level.color)}>
          {level.title}
        </p>

        <Button
          onClick={onClose}
          className="relative mt-5 bg-primary px-8 text-primary-foreground hover:bg-primary/90"
        >
          Awesome!
        </Button>
      </div>
    </div>
  )
}
