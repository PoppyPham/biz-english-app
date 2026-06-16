"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RotateCcw, Repeat, Sparkles } from "lucide-react"
import type { Phrase } from "@/lib/types"

type Result = "learned" | "learning"

interface FlashcardGameProps {
  phrases: Phrase[]
  userId: string | null
  categoryName: string
  categorySlug: string | null
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function FlashcardGame({
  phrases,
  userId,
  categoryName,
  categorySlug,
}: FlashcardGameProps) {
  const [deck, setDeck] = useState<Phrase[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)
  // phraseId -> result
  const [results, setResults] = useState<Record<string, Result>>({})

  // Shuffle on mount (client-only to avoid hydration mismatch)
  useEffect(() => {
    setDeck(shuffle(phrases))
  }, [phrases])

  const total = deck.length
  const current = deck[index]

  async function saveResult(phraseId: string, status: Result) {
    if (!userId) return
    const supabase = createClient()
    await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        phrase_id: phraseId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,phrase_id" }
    )
  }

  const answer = useCallback(
    (status: Result) => {
      if (!current || done) return
      const phraseId = current.id
      setResults((r) => ({ ...r, [phraseId]: status }))
      void saveResult(phraseId, status)

      if (index + 1 >= total) {
        setDone(true)
      } else {
        setIndex((i) => i + 1)
        setFlipped(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, done, index, total]
  )

  // Keyboard support
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return
      if (e.code === "Space") {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (e.key === "ArrowRight") {
        if (flipped) answer("learned")
      } else if (e.key === "ArrowLeft") {
        if (flipped) answer("learning")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flipped, done, answer])

  function restart(subset?: Phrase[]) {
    setDeck(shuffle(subset ?? phrases))
    setIndex(0)
    setFlipped(false)
    setResults({})
    setDone(false)
  }

  const backHref = categorySlug ? `/learn/${categorySlug}` : "/"

  // ── Loading (deck not yet shuffled) ──
  if (total === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
        <div className="size-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e]" />
      </div>
    )
  }

  // ── End screen ──
  if (done) {
    const masteredList = Object.entries(results)
      .filter(([, s]) => s === "learned")
      .map(([id]) => id)
    const missed = phrases.filter((p) => results[p.id] === "learning")
    const mastered = masteredList.length

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0f0f0f] px-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-full bg-[#22c55e]/10">
            <Sparkles className="size-8 text-[#22c55e]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Session complete!</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-[#22c55e]">{mastered}</span>{" "}
            {mastered === 1 ? "phrase" : "phrases"} mastered today 🎉
          </p>
          {!userId && (
            <p className="text-xs text-muted-foreground">
              Sign in to save your progress across sessions.
            </p>
          )}
        </div>

        {/* Mini summary */}
        <div className="flex gap-6 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-[#22c55e]">{mastered}</span>
            <span className="text-xs text-muted-foreground">Got it</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-amber-400">
              {missed.length}
            </span>
            <span className="text-xs text-muted-foreground">Still learning</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {missed.length > 0 && (
            <Button
              onClick={() => restart(missed)}
              className="gap-1.5 bg-[#22c55e] text-[#0f0f0f] hover:bg-[#22c55e]/90"
            >
              <Repeat className="size-4" />
              Retry missed ({missed.length})
            </Button>
          )}
          <Button onClick={() => restart()} variant="outline" className="gap-1.5">
            <RotateCcw className="size-4" />
            Keep studying
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
              Back to list
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ── Active game ──
  const progressPct = Math.round((index / total) * 100)

  return (
    <div className="flex min-h-screen flex-col bg-[#0f0f0f]">
      {/* Top bar + progress */}
      <div className="border-b border-[#2a2a2a] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Exit</span>
          </Link>
          <span className="truncate text-sm text-muted-foreground">
            {categoryName}
          </span>
          <span className="ml-auto shrink-0 text-sm font-medium tabular-nums">
            {index + 1} / {total}
          </span>
        </div>
        <div className="mx-auto mt-2 max-w-2xl">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
            <div
              className="h-full rounded-full bg-[#22c55e] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
        <div className="flip-scene w-full max-w-xl">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label="Flip card"
            className={cn(
              "flip-card aspect-[3/2] w-full cursor-pointer text-left",
              flipped && "is-flipped"
            )}
          >
            {/* Front — phrase */}
            <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8">
              <p className="text-center text-2xl font-bold leading-snug md:text-3xl">
                {current.phrase}
              </p>
              <p className="absolute bottom-5 text-xs text-muted-foreground">
                Tap or press Space to flip
              </p>
            </div>

            {/* Back — definition + example */}
            <div className="flip-face flip-face-back absolute inset-0 flex flex-col justify-center gap-4 overflow-y-auto rounded-2xl border border-[#22c55e]/30 bg-[#1a1a1a] p-8">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#22c55e]">
                  Definition
                </p>
                <p className="leading-relaxed">{current.definition}</p>
              </div>
              {current.example && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Example
                  </p>
                  <p className="italic leading-relaxed text-muted-foreground">
                    &ldquo;{current.example}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Answer buttons — only after flip */}
        <div
          className={cn(
            "flex w-full max-w-xl gap-3 transition-opacity duration-200",
            flipped ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          <Button
            onClick={() => answer("learning")}
            variant="outline"
            className="flex-1 border-amber-500/40 py-6 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          >
            Still Learning 🔄
          </Button>
          <Button
            onClick={() => answer("learned")}
            className="flex-1 border border-[#22c55e]/40 bg-[#22c55e]/10 py-6 text-[#22c55e] hover:bg-[#22c55e]/20"
          >
            Got it! ✅
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-xs text-muted-foreground">
          <kbd className="rounded bg-[#1a1a1a] px-1.5 py-0.5">Space</kbd> flip ·{" "}
          <kbd className="rounded bg-[#1a1a1a] px-1.5 py-0.5">←</kbd> still
          learning · <kbd className="rounded bg-[#1a1a1a] px-1.5 py-0.5">→</kbd>{" "}
          got it
        </p>
      </div>
    </div>
  )
}
