"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FlipHorizontal2,
  Repeat,
  Sparkles,
  Check,
  PartyPopper,
} from "lucide-react"
import { Ipa } from "@/components/Ipa"
import { SpeakButton } from "@/components/SpeakButton"
import { SoundToggle } from "@/components/SoundToggle"
import { playCelebrate, playNeutral, playComplete } from "@/lib/sounds"
import { speakText } from "@/lib/speak"
import { ExampleQuote } from "@/components/ExampleQuote"
import type { Phrase, UserProgress } from "@/lib/types"

type Result = "learned" | "learning"
type Status = "new" | "learning" | "learned"

interface FlashcardGameProps {
  phrases: Phrase[]
  userId: string | null
  categoryName: string
  categorySlug: string | null
  initialProgress: Pick<UserProgress, "phrase_id" | "status">[]
}

// After "Got it", the card auto-advances once the definition/example has
// been shown for this long — enough time to actually read it.
const GOT_IT_READING_MS = 7000

// Scale the example text down as it gets longer, so a long example still
// fits on screen instead of getting cramped against the floating controls.
function exampleSizeClass(text: string | null | undefined): string {
  const len = text?.length ?? 0
  // Most examples pair an English sentence with a Vietnamese translation,
  // which adds up fast inside the card's fixed, fairly short height — so
  // scale down early rather than only for the extreme cases.
  if (len > 180) return "text-xs"
  if (len > 50) return "text-sm"
  return "text-base"
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
  initialProgress,
}: FlashcardGameProps) {
  const [deck, setDeck] = useState<Phrase[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [decided, setDecided] = useState(false) // this card graded this round
  const [justGotIt, setJustGotIt] = useState(false) // brief celebratory overlay
  const [done, setDone] = useState(false)
  // phraseId -> result, this session (for the end-screen summary)
  const [results, setResults] = useState<Record<string, Result>>({})

  // Persisted status per phrase (seeded from the DB, updated live as the
  // user grades cards) — drives the "how far along am I" progress bar.
  const [progressMap, setProgressMap] = useState<Record<string, Status>>(() =>
    Object.fromEntries(initialProgress.map((p) => [p.phrase_id, p.status]))
  )
  const [memorizedPopup, setMemorizedPopup] = useState<number | null>(null)
  const [showBurst, setShowBurst] = useState(false) // big "reward" celebration
  const popupKey = useRef(0)

  const burstTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shuffle on mount (client-only to avoid hydration mismatch)
  useEffect(() => {
    setDeck(shuffle(phrases))
    return () => {
      if (burstTimeout.current) clearTimeout(burstTimeout.current)
    }
  }, [phrases])

  const total = deck.length
  const current = deck[index]

  // Live tally across the whole deck — learned / learning / new.
  const progressStats = useMemo(() => {
    let learned = 0
    let learning = 0
    for (const p of phrases) {
      const status = progressMap[p.id] ?? "new"
      if (status === "learned") learned++
      else if (status === "learning") learning++
    }
    return {
      learned,
      learning,
      newCount: phrases.length - learned - learning,
      total: phrases.length,
    }
  }, [progressMap, phrases])

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

  function goToIndex(next: number) {
    if (burstTimeout.current) clearTimeout(burstTimeout.current)
    if (next >= total) {
      setDone(true)
    } else {
      setIndex(next)
      setFlipped(false)
      setDecided(false)
      setJustGotIt(false)
      setShowBurst(false)
    }
  }

  // Once a card has been graded, let the user flip back and forth to
  // review — not available before deciding, so the front→back order stays
  // intentional (decide first, then peek). Flipping manually means "let me
  // read this properly" — cancel any pending Got-it auto-advance so it
  // doesn't yank the card away mid-review.
  function toggleFlip() {
    if (!decided) return
    if (burstTimeout.current) {
      clearTimeout(burstTimeout.current)
      burstTimeout.current = null
    }
    setShowBurst(false)
    setFlipped((f) => !f)
  }

  const handleGotIt = useCallback(() => {
    if (!current || decided || done) return
    setDecided(true)
    setJustGotIt(true)
    setResults((r) => ({ ...r, [current.id]: "learned" }))
    setProgressMap((m) => ({ ...m, [current.id]: "learned" }))
    void saveResult(current.id, "learned")

    // Say the word first, then celebrate, then reveal the definition/example
    // so there's something to read while the auto-advance timer runs (the
    // user can still flip back or hit Next early; either cancels it).
    speakText(current.phrase, "en-US", () => {
      playCelebrate()
      popupKey.current += 1
      setMemorizedPopup(popupKey.current)
      setShowBurst(true)
      if (burstTimeout.current) clearTimeout(burstTimeout.current)
      burstTimeout.current = setTimeout(() => {
        setShowBurst(false)
        setFlipped(true)
        burstTimeout.current = setTimeout(() => {
          goToIndex(index + 1)
        }, GOT_IT_READING_MS)
      }, 1100)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, decided, done, index])

  const handleStillLearning = useCallback(() => {
    if (!current || decided || done) return
    setDecided(true)
    setResults((r) => ({ ...r, [current.id]: "learning" }))
    setProgressMap((m) => ({ ...m, [current.id]: "learning" }))
    playNeutral()
    void saveResult(current.id, "learning")
    setFlipped(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, decided, done])

  // Auto-pronounce the phrase the moment the back is revealed.
  useEffect(() => {
    if (flipped && current) speakText(current.phrase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped])

  useEffect(() => {
    if (done) playComplete()
  }, [done])

  function goNext() {
    if (index + 1 < total) goToIndex(index + 1)
  }

  function goPrev() {
    if (index > 0) goToIndex(index - 1)
  }

  // Keyboard support: arrows grade the front; Space continues either way.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return
      if (e.code === "Space") {
        e.preventDefault()
        if (decided) goNext()
      } else if (e.key === "ArrowRight" && !decided) {
        handleGotIt()
      } else if (e.key === "ArrowLeft" && !decided) {
        handleStillLearning()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [decided, done, handleGotIt, handleStillLearning, index, total])

  function restart(subset?: Phrase[]) {
    if (burstTimeout.current) clearTimeout(burstTimeout.current)
    setDeck(shuffle(subset ?? phrases))
    setIndex(0)
    setFlipped(false)
    setDecided(false)
    setJustGotIt(false)
    setShowBurst(false)
    setResults({})
    setDone(false)
  }

  const backHref = categorySlug ? `/learn/${categorySlug}` : "/"

  // ── Loading (deck not yet shuffled) ──
  if (total === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Session complete!</h1>
          <p className="text-muted-foreground">
            <span className="font-semibold text-primary">{mastered}</span>{" "}
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
            <span className="text-xl font-bold text-primary">{mastered}</span>
            <span className="text-xs text-muted-foreground">Got it</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-amber-400">
              {missed.length}
            </span>
            <span className="text-xs text-muted-foreground">Still learning</span>
          </div>
        </div>

        {/* Overall category progress */}
        {userId && progressStats.total > 0 && (
          <div className="w-full max-w-xs">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-border">
              {progressStats.learned > 0 && (
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(progressStats.learned / progressStats.total) * 100}%` }}
                />
              )}
              {progressStats.learning > 0 && (
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${(progressStats.learning / progressStats.total) * 100}%` }}
                />
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {progressStats.learned}/{progressStats.total} memorized in{" "}
              {categoryName}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {missed.length > 0 && (
            <Button
              onClick={() => restart(missed)}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
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
  const sessionPct = Math.round((index / total) * 100)

  // Reward badge content for the "memorized" burst — shared between the two
  // anchor points below (relative to the overall progress bar when it's
  // shown, or standalone for guests who don't have one).
  const burstBadge = showBurst && (
    <div className="relative flex flex-col items-center gap-0.5 rounded-2xl border border-primary/30 bg-card/95 px-6 py-3 shadow-xl backdrop-blur animate-pop-in">
      <span className="absolute top-4 size-20 rounded-full bg-primary/30 animate-burst-ring" />
      <div className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
        <PartyPopper className="size-6" />
      </div>
      <p className="relative text-2xl font-extrabold text-primary">
        {progressStats.learned}
      </p>
      <p className="relative text-[11px] font-semibold uppercase tracking-wider text-primary/80">
        memorized!
      </p>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <span
          key={deg}
          className="absolute top-4 size-1.5 rounded-full bg-primary animate-sparkle-out"
          style={
            {
              "--sx": `${Math.round(Math.cos((deg * Math.PI) / 180) * 60)}px`,
              "--sy": `${Math.round(Math.sin((deg * Math.PI) / 180) * 60)}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar + progress */}
      <div className="border-b border-border px-4 py-3 md:px-8">
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
          <SoundToggle className="ml-auto" />
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {index + 1} / {total}
          </span>
        </div>
        <div className="mx-auto mt-2 max-w-2xl">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${sessionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Card area */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
        {/* Overall memorized-so-far bar — the "excitement about progress" HUD.
            Lives in the main content area (not the cramped top bar) so it has
            room to breathe at a readable size. */}
        {userId && progressStats.total > 0 && (
          <div className="relative w-full max-w-xl">
            <div className="relative flex h-3.5 w-full overflow-hidden rounded-full bg-card">
              {progressStats.learned > 0 && (
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(progressStats.learned / progressStats.total) * 100}%` }}
                />
              )}
              {progressStats.learning > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${(progressStats.learning / progressStats.total) * 100}%` }}
                />
              )}
              {memorizedPopup !== null && (
                <span
                  key={memorizedPopup}
                  onAnimationEnd={() => setMemorizedPopup(null)}
                  className="pointer-events-none absolute -top-1 right-0 text-base font-bold text-primary animate-float-up"
                >
                  +1
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">
                {progressStats.learned}
              </span>{" "}
              memorized ·{" "}
              <span className="font-semibold text-amber-400">
                {progressStats.learning}
              </span>{" "}
              learning ·{" "}
              <span className="font-medium text-foreground">
                {progressStats.total}
              </span>{" "}
              total in {categoryName}
            </p>

            {/* Reward burst toast — anchored 25px above this bar, never
                overlapping it, regardless of where the bar sits on screen. */}
            {showBurst && (
              <div className="pointer-events-none absolute inset-x-0 bottom-full z-30 mb-[25px] flex justify-center">
                {burstBadge}
              </div>
            )}
          </div>
        )}

        {/* Guests without the progress bar still get the reward toast —
            shown at the top of the card wrapper instead. */}
        {showBurst && !(userId && progressStats.total > 0) && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-4">
            {burstBadge}
          </div>
        )}

        <div className="relative w-full max-w-xl">
          {/* Flip card */}
          <div
            key={current.id}
            className="flip-scene animate-in fade-in zoom-in-95 duration-200"
          >
            <div
              className={cn(
                "flip-card aspect-[3/2] w-full",
                flipped && "is-flipped"
              )}
            >
              {/* Front — phrase + IPA + speak, decide, then act */}
              <div
                className={cn(
                  "flip-face absolute inset-0 flex flex-col rounded-2xl border p-6 transition-colors md:p-8",
                  justGotIt
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                )}
              >
                {justGotIt && (
                  <div className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 fade-in duration-200">
                    <Check className="size-4" />
                  </div>
                )}

                {/* Content — centered in the space above the floating controls */}
                <div
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-3",
                    decided && "pb-14"
                  )}
                >
                  <p className="text-center text-2xl font-bold leading-snug md:text-3xl">
                    {current.phrase}
                  </p>
                  <div className="flex items-center gap-2">
                    <Ipa
                      phraseId={current.id}
                      text={current.phrase}
                      initialIpa={current.ipa}
                      className="text-sm"
                    />
                    <SpeakButton text={current.phrase} />
                  </div>
                </div>

                {decided ? (
                  <>
                    {/* Flip control — floating, bottom-center, so it never
                        crowds the content above it. */}
                    <button
                      type="button"
                      onClick={toggleFlip}
                      aria-label="Flip to see definition"
                      className="absolute bottom-4 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-border-hover hover:text-foreground active:scale-95"
                    >
                      <FlipHorizontal2 className="size-4" />
                    </button>
                    {/* Next — floating, bottom-right, compact so it stays
                        out of the way instead of a full-width bar. */}
                    <Button
                      onClick={goNext}
                      size="sm"
                      className="absolute bottom-4 right-4 gap-1 rounded-full bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90"
                    >
                      {index + 1 >= total ? "See results" : "Next"}
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                ) : (
                  <div className="flex w-full gap-3">
                    <Button
                      onClick={handleStillLearning}
                      variant="outline"
                      className="flex-1 border-amber-500/40 py-6 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 active:scale-95 transition-transform"
                    >
                      Still Learning 🔄
                    </Button>
                    <Button
                      onClick={handleGotIt}
                      className="flex-1 border border-primary/40 bg-primary/10 py-6 text-primary hover:bg-primary/20 active:scale-95 transition-transform"
                    >
                      Got it! ✅
                    </Button>
                  </div>
                )}
              </div>

              {/* Back — definition + example (only reached via "Still Learning" or the rotate button) */}
              <div className="flip-face flip-face-back absolute inset-0 rounded-2xl border border-primary/30 bg-card">
                {/* Scroll region is inset from the bottom edge (not just
                    padded) so its clipped viewport never reaches under the
                    floating controls, at any scroll position. */}
                <div className="absolute inset-x-6 top-6 bottom-16 overflow-y-auto md:inset-x-8 md:top-8">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                    Definition
                  </p>
                  <p className="leading-relaxed">{current.definition}</p>
                  {current.example && (
                    <div className="mt-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Example
                      </p>
                      <ExampleQuote
                        text={current.example}
                        lineClassName={cn(
                          "italic leading-relaxed text-muted-foreground",
                          exampleSizeClass(current.example)
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* Flip control — floating, bottom-center */}
                <button
                  type="button"
                  onClick={toggleFlip}
                  aria-label="Flip back to the phrase"
                  className="absolute bottom-4 left-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-border-hover hover:text-foreground active:scale-95"
                >
                  <FlipHorizontal2 className="size-4" />
                </button>
                {/* Next — floating, bottom-right, compact */}
                <Button
                  onClick={goNext}
                  size="sm"
                  className="absolute bottom-4 right-4 gap-1 rounded-full bg-primary px-4 text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  {index + 1 >= total ? "See results" : "Next"}
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Prev / Next navigation (skip without grading) */}
        <div className="flex w-full max-w-xl items-center justify-between">
          <Button
            onClick={goPrev}
            disabled={index === 0}
            variant="secondary"
            size="sm"
            className="gap-1.5"
          >
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            {index + 1} / {total}
          </span>
          <Button
            onClick={goNext}
            disabled={index >= total - 1}
            variant="secondary"
            size="sm"
            className="gap-1.5"
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-xs text-muted-foreground">
          <kbd className="rounded bg-card px-1.5 py-0.5">←</kbd> still learning ·{" "}
          <kbd className="rounded bg-card px-1.5 py-0.5">→</kbd> got it ·{" "}
          <kbd className="rounded bg-card px-1.5 py-0.5">Space</kbd> continue
        </p>
      </div>
    </div>
  )
}
