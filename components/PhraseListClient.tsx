"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PhraseCard } from "@/components/PhraseCard"
import { LevelUpPopup } from "@/components/LevelUpPopup"
import type { PhraseWithProgress } from "@/lib/types"
import type { MasteryLevelDef } from "@/lib/mastery"

type Filter = "all" | "new" | "learning" | "learned" | "favorites"

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "learned", label: "Learned" },
  { value: "favorites", label: "Favorites" },
]

interface PhraseListClientProps {
  phrases: PhraseWithProgress[]
  userId: string | null
  categorySlug: string
}

export function PhraseListClient({
  phrases,
  userId,
}: PhraseListClientProps) {
  const [filter, setFilter] = useState<Filter>("all")
  const [levelUpInfo, setLevelUpInfo] = useState<MasteryLevelDef | null>(null)

  const filtered = phrases.filter((p) => {
    if (filter === "all") return true
    if (filter === "favorites") return p.progress?.is_favorite
    return (p.progress?.status ?? "new") === filter
  })

  const counts: Record<Filter, number> = {
    all: phrases.length,
    new: phrases.filter((p) => (p.progress?.status ?? "new") === "new").length,
    learning: phrases.filter((p) => p.progress?.status === "learning").length,
    learned: phrases.filter((p) => p.progress?.status === "learned").length,
    favorites: phrases.filter((p) => p.progress?.is_favorite).length,
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <LevelUpPopup level={levelUpInfo} onClose={() => setLevelUpInfo(null)} />
      {/* Filter tabs */}
      {userId && (
        <div className="mb-6 overflow-x-auto no-scrollbar">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as Filter)}
          >
            <TabsList className="h-auto gap-1 bg-card p-1 border border-border">
              {FILTERS.map(({ value, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-7 rounded-md px-3 text-xs data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold dark:data-active:bg-primary dark:data-active:text-primary-foreground dark:data-active:border-transparent"
                >
                  {label}
                  {counts[value] > 0 && (
                    <span className="ml-1.5 tabular-nums text-muted-foreground">
                      {counts[value]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Phrase list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-muted-foreground">
            {filter === "favorites"
              ? "No favorited phrases yet"
              : `No ${filter} phrases`}
          </p>
          {filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              className="text-sm text-primary hover:underline underline-offset-2"
            >
              View all phrases
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((phrase) => (
            <PhraseCard
              key={phrase.id}
              phrase={phrase}
              userId={userId}
              onLevelUp={setLevelUpInfo}
            />
          ))}
        </div>
      )}
    </div>
  )
}
