"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { PhraseWithProgress, UserProgress } from "@/lib/types"

type Status = UserProgress["status"]

const STATUS_CONFIG: Record<
  Status,
  { label: string; className: string }
> = {
  new: {
    label: "New",
    className: "border-[#2a2a2a] text-muted-foreground hover:border-foreground/30",
  },
  learning: {
    label: "Learning",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
  },
  learned: {
    label: "Learned",
    className: "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20",
  },
}

interface PhraseCardProps {
  phrase: PhraseWithProgress
  userId: string | null
}

export function PhraseCard({ phrase, userId }: PhraseCardProps) {
  const [status, setStatus] = useState<Status>(
    phrase.progress?.status ?? "new"
  )
  const [isFavorite, setIsFavorite] = useState(
    phrase.progress?.is_favorite ?? false
  )
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingFav, setSavingFav] = useState(false)

  const truncated =
    phrase.definition.length > 80
      ? phrase.definition.slice(0, 80).trimEnd() + "…"
      : phrase.definition

  async function handleStatus(next: Status) {
    if (!userId || savingStatus || next === status) return
    const prev = status
    setStatus(next) // optimistic
    setSavingStatus(true)

    const supabase = createClient()
    const { error } = await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        phrase_id: phrase.id,
        status: next,
        is_favorite: isFavorite,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,phrase_id" }
    )

    if (error) setStatus(prev) // rollback
    setSavingStatus(false)
  }

  async function handleFavorite(e: React.MouseEvent) {
    e.preventDefault() // don't navigate
    if (!userId || savingFav) return
    const next = !isFavorite
    setIsFavorite(next) // optimistic
    setSavingFav(true)

    const supabase = createClient()
    const { error } = await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        phrase_id: phrase.id,
        status,
        is_favorite: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,phrase_id" }
    )

    if (error) setIsFavorite(!next) // rollback
    setSavingFav(false)
  }

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 transition-colors hover:border-[#3a3a3a]">
      {/* Phrase + favorite */}
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/phrase/${phrase.id}`}
          className="min-w-0 flex-1 hover:underline underline-offset-2"
        >
          <p className="font-medium leading-snug">{phrase.phrase}</p>
          <p className="mt-1 text-sm text-muted-foreground">{truncated}</p>
        </Link>

        {userId && (
          <button
            onClick={handleFavorite}
            disabled={savingFav}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className={cn(
              "shrink-0 rounded-md p-1 transition-colors",
              isFavorite
                ? "text-rose-400 hover:text-rose-300"
                : "text-muted-foreground hover:text-rose-400"
            )}
          >
            <Heart
              className={cn("size-4", isFavorite && "fill-current")}
            />
          </button>
        )}
      </div>

      {/* Status row */}
      {userId ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {(["new", "learning", "learned"] as Status[]).map((s) => (
              <button
                key={s}
                onClick={(e) => {
                  e.preventDefault()
                  handleStatus(s)
                }}
                disabled={savingStatus}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all",
                  status === s
                    ? STATUS_CONFIG[s].className
                    : "border-[#2a2a2a] text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                )}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {/* Current status badge — visible at rest, fades on hover */}
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 border text-[10px] px-1.5 transition-opacity group-hover:opacity-0",
              STATUS_CONFIG[status].className
            )}
          >
            {STATUS_CONFIG[status].label}
          </Badge>
        </div>
      ) : (
        <Link
          href={`/phrase/${phrase.id}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in to track progress →
        </Link>
      )}
    </div>
  )
}
