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
  RotateCw,
  Repeat,
  Sparkles,
  Check,
  PartyPopper,
} from "lucide-react"
import { Ipa } from "@/components/Ipa"
import { SpeakButton } from "@/components/SpeakButton"
import { SoundToggle } from "@/components/SoundToggle"
import { playMemorized, playNeutral, playComplete } from "@/lib/sounds"
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
  // intentional (decide first, then peek).
  function toggleFlip() {
    if (!decided) return
    setFlipped((f) => !f)
  }

  const handleGotIt = useCallback(() => {
    if (!current || decided || done) return
    setDecided(true)
    setJustGotIt(true)
    setResults((r) => ({ ...r, [current.id]: "learned" }))
    setProgressMap((m) => ({ ...m, [current.id]: "learned" }))
    popupKey.current += 1
    setMemorizedPopup(popupKey.current)
    playMemorized()
    void saveResult(current.id, "learned")

    // Big reward-style celebration — stays until the user is ready to move
    // on (they can flip to peek at the definition first via the rotate
    // button, or just hit Next).
    setShowBurst(true)
    if (burstTimeout.current) clearTimeout(burstTimeout.current)
    burstTimeout.current = setTimeout(() => setShowBurst(false), 1100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, decided, done])

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

        {/* Overall memorized-so-far bar — the "excitement about progress" HUD */}
        {userId && progressStats.total > 0 && (
          <div className="mx-auto mt-2 max-w-2xl">
            <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-card">
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
                  className="pointer-events-none absolute -top-1 right-0 text-sm font-bold text-primary animate-float-up"
                >
                  +1
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium text-primary">
                {progressStats.learned}
              </span>{" "}
              memorized ·{" "}
              <span className="font-medium text-amber-400">
                {progressStats.learning}
              </span>{" "}
              learning · {progressStats.total} total in {categoryName}
            </p>
          </div>
        )}
      </div>

      {/* Card area */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
        {/* Flip card */}
        <div
          key={current.id}
          className="flip-scene relative w-full max-w-xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div
            className={cn(
              "flip-card aspect-[3/2] w-full",
              flipped && "is-flipped"
            )}
          >
            {/* Front — phrase + IPA + speak + grading buttons */}
            <div
              className={cn(
                "flip-face absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 transition-colors",
                justGotIt
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card"
              )}
            >
              {justGotIt && (
                <div className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50 fade-in duration-200">
                  <Check className="size-4" />
                </div>
              )}
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

              {decided ? (
                /* After grading via Got it — review (flip) or continue */
                <div className="mt-2 flex w-full max-w-sm gap-3">
                  <Button
                    onClick={toggleFlip}
                    variant="outline"
                    aria-label="Flip to see definition"
                    className="h-auto shrink-0 px-4 py-6"
                  >
                    <RotateCw className="size-4" />
                  </Button>
                  <Button
                    onClick={goNext}
                    className="flex-1 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {index + 1 >= total ? "See results" : "Next"}
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : (
                /* Grading buttons — shown on the FRONT, before any flip */
                <div className="mt-2 flex w-full max-w-sm gap-3">
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

              {/* Big reward-style burst celebration */}
              {showBurst && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <span className="absolute size-24 rounded-full bg-primary/30 animate-burst-ring" />
                  <div className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg animate-pop-in">
                    <PartyPopper className="size-8" />
                  </div>
                  <p className="relative mt-1 animate-pop-in text-4xl font-extrabold text-primary">
                    {progressStats.learned}
                  </p>
                  <p className="relative text-xs font-semibold uppercase tracking-wider text-primary/80">
                    memorized!
                  </p>
                  {[0, 60, 120, 180, 240, 300].map((deg) => (
                    <span
                      key={deg}
                      className="absolute size-1.5 rounded-full bg-primary animate-sparkle-out"
                      style={
                        {
                          "--sx": `${Math.round(Math.cos((deg * Math.PI) / 180) * 90)}px`,
                          "--sy": `${Math.round(Math.sin((deg * Math.PI) / 180) * 90)}px`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Back — definition + example (only reached via "Still Learning") */}
            <div className="flip-face flip-face-back absolute inset-0 flex flex-col justify-center gap-4 overflow-y-auto rounded-2xl border border-primary/30 bg-card p-8">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  Definition
                </p>
                <p className="leading-relaxed">{current.definition}</p>
              </div>
              {current.example && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Example
                  </p>
                  <ExampleQuote
                    text={current.example}
                    lineClassName="italic leading-relaxed text-muted-foreground"
                  />
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={toggleFlip}
                  variant="outline"
                  aria-label="Flip back to the phrase"
                  className="h-auto shrink-0 px-4"
                >
                  <RotateCw className="size-4" />
                </Button>
                <Button
                  onClick={goNext}
                  className="flex-1 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
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
            variant="outline"
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
            variant="outline"
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
