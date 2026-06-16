"use client"

import { useState } from "react"
import { Heart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { UserProgress } from "@/lib/types"

type Status = UserProgress["status"]

const STATUS_CONFIG: Record<Status, { label: string; activeClass: string }> = {
  new: {
    label: "New",
    activeClass: "border-foreground/30 bg-foreground/10 text-foreground",
  },
  learning: {
    label: "Learning",
    activeClass: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  },
  learned: {
    label: "Learned",
    activeClass: "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]",
  },
}

interface PhraseDetailControlsProps {
  phraseId: string
  userId: string
  initialStatus: Status
  initialFavorite: boolean
}

export function PhraseDetailControls({
  phraseId,
  userId,
  initialStatus,
  initialFavorite,
}: PhraseDetailControlsProps) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [isFavorite, setIsFavorite] = useState(initialFavorite)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingFav, setSavingFav] = useState(false)

  async function upsert(patch: Partial<{ status: Status; is_favorite: boolean }>) {
    const supabase = createClient()
    await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        phrase_id: phraseId,
        status,
        is_favorite: isFavorite,
        updated_at: new Date().toISOString(),
        ...patch,
      },
      { onConflict: "user_id,phrase_id" }
    )
  }

  async function handleStatus(next: Status) {
    if (savingStatus || next === status) return
    const prev = status
    setStatus(next)
    setSavingStatus(true)
    const { error } = await (async () => {
      const supabase = createClient()
      return supabase.from("user_progress").upsert(
        { user_id: userId, phrase_id: phraseId, status: next, is_favorite: isFavorite, updated_at: new Date().toISOString() },
        { onConflict: "user_id,phrase_id" }
      )
    })()
    if (error) setStatus(prev)
    setSavingStatus(false)
  }

  async function handleFavorite() {
    if (savingFav) return
    const next = !isFavorite
    setIsFavorite(next)
    setSavingFav(true)
    const supabase = createClient()
    const { error } = await supabase.from("user_progress").upsert(
      { user_id: userId, phrase_id: phraseId, status, is_favorite: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id,phrase_id" }
    )
    if (error) setIsFavorite(!next)
    setSavingFav(false)
  }

  return (
    <div className="flex items-center gap-3">
      {/* Status buttons */}
      <div className="flex gap-2">
        {(["new", "learning", "learned"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => handleStatus(s)}
            disabled={savingStatus}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
              status === s
                ? STATUS_CONFIG[s].activeClass
                : "border-[#2a2a2a] text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-[#2a2a2a]" />

      {/* Favorite */}
      <button
        onClick={handleFavorite}
        disabled={savingFav}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
          isFavorite
            ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
            : "border-[#2a2a2a] text-muted-foreground hover:border-foreground/20 hover:text-foreground"
        )}
      >
        <Heart className={cn("size-4", isFavorite && "fill-current")} />
        {isFavorite ? "Saved" : "Save"}
      </button>
    </div>
  )
}
