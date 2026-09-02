"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMasteryProgress } from "@/lib/mastery"
import { cn } from "@/lib/utils"
import { Trophy, Crown, Medal, BookOpen } from "lucide-react"

export interface LeaderboardRow {
  user_id: string
  display_name: string | null
  best_score: number
  learned_count: number
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const RANK_STYLE = [
  { icon: Crown, color: "text-yellow-300", glow: "bg-yellow-300/15" },
  { icon: Medal, color: "text-slate-300", glow: "bg-slate-300/15" },
  { icon: Medal, color: "text-amber-600", glow: "bg-amber-600/15" },
]

type Mode = "quiz" | "flashcard"

const MODES: {
  key: Mode
  label: string
  icon: typeof Trophy
  statLabel: string
  statColor: string
}[] = [
  { key: "quiz", label: "Quiz", icon: Trophy, statLabel: "score", statColor: "text-yellow-400" },
  { key: "flashcard", label: "Flashcard", icon: BookOpen, statLabel: "learned", statColor: "text-primary" },
]

export function LeaderboardTabs({
  rows,
  currentUserId,
}: {
  rows: LeaderboardRow[]
  currentUserId: string
}) {
  const [mode, setMode] = useState<Mode>("quiz")
  const activeMode = MODES.find((m) => m.key === mode)!

  const sorted = useMemo(() => {
    const key = mode === "quiz" ? "best_score" : "learned_count"
    return [...rows].sort((a, b) => b[key] - a[key])
  }, [rows, mode])

  return (
    <div>
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="h-10 w-full sm:w-auto">
          {MODES.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-1.5 px-4 py-1.5">
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-2">
        {sorted.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No players yet.
          </p>
        )}

        {sorted.map((row, i) => {
          const rank = i + 1
          const rankStyle = RANK_STYLE[i]
          const mastery = getMasteryProgress(row.learned_count)
          const MasteryIcon = mastery.current.icon
          const isMe = row.user_id === currentUserId
          const name = row.display_name?.trim() || "Anonymous"
          const stat = mode === "quiz" ? row.best_score : row.learned_count

          return (
            <div
              key={row.user_id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                isMe
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              {/* Rank */}
              <div className="flex size-9 shrink-0 items-center justify-center">
                {rankStyle ? (
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full",
                      rankStyle.glow
                    )}
                  >
                    <rankStyle.icon className={cn("size-5", rankStyle.color)} />
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    {rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initials(name)}
              </span>

              {/* Name + mastery level */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name}
                  {isMe && (
                    <span className="ml-1.5 text-xs font-normal text-primary">
                      (you)
                    </span>
                  )}
                </p>
                <p
                  className={cn(
                    "flex items-center gap-1 truncate text-xs",
                    mastery.current.color
                  )}
                >
                  <MasteryIcon className="size-3.5 shrink-0" />
                  {mastery.current.title}
                </p>
              </div>

              {/* Ranked stat */}
              <div className="shrink-0 text-right">
                <p className={cn("text-lg font-bold", activeMode.statColor)}>
                  {stat.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {activeMode.statLabel}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
