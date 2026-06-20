"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Star,
  Share2,
  RotateCcw,
  Timer,
} from "lucide-react"
import { Ipa } from "@/components/Ipa"
import type { Phrase } from "@/lib/types"

const QUIZ_SIZE = 20
const TIMER_SECONDS = 15

interface QuizGameProps {
  phrases: Phrase[]
  userId: string | null
  categoryName: string
  categorySlug: string | null
}

interface Option {
  text: string
  correct: boolean
}
interface Question {
  phrase: Phrase
  options: Option[]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildQuestions(phrases: Phrase[]): Question[] {
  const picked = shuffle(phrases).slice(0, Math.min(QUIZ_SIZE, phrases.length))

  return picked.map((phrase) => {
    // Distractors: 3 random definitions from OTHER phrases (unique text)
    const others = phrases.filter(
      (p) => p.id !== phrase.id && p.definition !== phrase.definition
    )
    const distractors = shuffle(others)
      .slice(0, 3)
      .map((p) => ({ text: p.definition, correct: false }))

    const options = shuffle([
      { text: phrase.definition, correct: true },
      ...distractors,
    ])

    return { phrase, options }
  })
}

export function QuizGame({
  phrases,
  userId,
  categoryName,
  categorySlug,
}: QuizGameProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)

  // Share feedback
  const [shareLabel, setShareLabel] = useState("Share result")

  const backHref = categorySlug ? `/learn/${categorySlug}` : "/"

  // Build questions on mount (client-only → no hydration mismatch)
  useEffect(() => {
    setQuestions(buildQuestions(phrases))
  }, [phrases])

  const total = questions.length
  const current = questions[index]

  async function saveResult(phraseId: string, correct: boolean) {
    if (!userId) return
    const supabase = createClient()
    await supabase.from("user_progress").upsert(
      {
        user_id: userId,
        phrase_id: phraseId,
        status: correct ? "learned" : "learning",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,phrase_id" }
    )
  }

  const handleAnswer = useCallback(
    (optionIdx: number | null) => {
      if (answered || !current) return
      setAnswered(true)
      setSelected(optionIdx)
      const correct =
        optionIdx !== null && current.options[optionIdx]?.correct === true
      if (correct) setScore((s) => s + 1)
      void saveResult(current.phrase.id, correct)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answered, current]
  )

  // Per-question countdown
  useEffect(() => {
    if (!timerEnabled || answered || done || !current) return
    setTimeLeft(TIMER_SECONDS)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id)
          handleAnswer(null) // time out = no answer
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [index, timerEnabled, answered, done, current, handleAnswer])

  function next() {
    if (index + 1 >= total) {
      setDone(true)
    } else {
      setIndex((i) => i + 1)
      setSelected(null)
      setAnswered(false)
      setTimeLeft(TIMER_SECONDS)
    }
  }

  function restart() {
    setQuestions(buildQuestions(phrases))
    setIndex(0)
    setSelected(null)
    setAnswered(false)
    setScore(0)
    setDone(false)
    setTimeLeft(TIMER_SECONDS)
  }

  async function share(pct: number, stars: number) {
    const text = `I scored ${score}/${total} (${pct}%) ${"⭐".repeat(
      stars
    )} on the BizEnglish ${categoryName} quiz!`
    try {
      if (navigator.share) {
        await navigator.share({ title: "BizEnglish Quiz", text })
      } else {
        await navigator.clipboard.writeText(text)
        setShareLabel("Copied!")
        setTimeout(() => setShareLabel("Share result"), 2000)
      }
    } catch {
      /* user cancelled share — ignore */
    }
  }

  // ── Loading ──
  if (total === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
        <div className="size-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e]" />
      </div>
    )
  }

  // ── End screen ──
  if (done) {
    const pct = Math.round((score / total) * 100)
    const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0
    const message =
      stars === 3
        ? "Outstanding! 🏆"
        : stars === 2
        ? "Great job! 👏"
        : stars === 1
        ? "Good effort! 👍"
        : "Keep practicing! 💪"

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0f0f0f] px-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{message}</h1>

        {/* Stars */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Star
              key={i}
              className={cn(
                "size-10 transition-colors",
                i < stars
                  ? "fill-[#22c55e] text-[#22c55e]"
                  : "fill-transparent text-[#2a2a2a]"
              )}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-4xl font-bold">
            <span className="text-[#22c55e]">{score}</span>
            <span className="text-muted-foreground"> / {total}</span>
          </p>
          <p className="text-sm text-muted-foreground">{pct}% correct</p>
          {!userId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Sign in to save your progress.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => share(pct, stars)}
            className="gap-1.5 bg-[#22c55e] text-[#0f0f0f] hover:bg-[#22c55e]/90"
          >
            <Share2 className="size-4" />
            {shareLabel}
          </Button>
          <Button onClick={restart} variant="outline" className="gap-1.5">
            <RotateCcw className="size-4" />
            Play again
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

  // ── Active question ──
  const progressPct = Math.round((index / total) * 100)

  return (
    <div className="flex min-h-screen flex-col bg-[#0f0f0f]">
      {/* Top bar */}
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
            <span className="text-[#22c55e]">{score}</span> / {total}
          </span>
        </div>

        {/* Question progress */}
        <div className="mx-auto mt-2 max-w-2xl">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
            <div
              className="h-full rounded-full bg-[#22c55e] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timer bar + toggle */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-3 md:px-0">
        <div className="flex items-center gap-3">
          <Timer className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1a1a1a]">
            {timerEnabled && !answered && (
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-linear",
                  timeLeft <= 5 ? "bg-rose-500" : "bg-amber-400"
                )}
                style={{ width: `${(timeLeft / TIMER_SECONDS) * 100}%` }}
              />
            )}
          </div>
          <button
            onClick={() => setTimerEnabled((v) => !v)}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {timerEnabled ? `Skip timer (${timeLeft}s)` : "Enable timer"}
          </button>
        </div>
      </div>

      {/* Question */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:px-0">
        <div className="text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Question {index + 1} — What does this mean?
          </p>
          <h2 className="text-2xl font-bold leading-snug md:text-3xl">
            {current.phrase.phrase}
          </h2>
          <div className="mt-1.5">
            <Ipa
              phraseId={current.phrase.id}
              text={current.phrase.phrase}
              initialIpa={current.phrase.ipa}
              className="text-sm"
            />
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {current.options.map((opt, i) => {
            const isChosen = selected === i
            const showCorrect = answered && opt.correct
            const showWrong = answered && isChosen && !opt.correct

            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-4 text-left text-sm transition-all",
                  !answered &&
                    "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] hover:bg-[#1e1e1e]",
                  showCorrect &&
                    "border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e]",
                  showWrong && "border-rose-500/50 bg-rose-500/10 text-rose-400",
                  answered &&
                    !showCorrect &&
                    !showWrong &&
                    "border-[#2a2a2a] bg-[#1a1a1a] opacity-50"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    showCorrect && "border-[#22c55e] bg-[#22c55e] text-[#0f0f0f]",
                    showWrong && "border-rose-500 bg-rose-500 text-white",
                    !showCorrect &&
                      !showWrong &&
                      "border-[#2a2a2a] text-muted-foreground"
                  )}
                >
                  {showCorrect ? (
                    <Check className="size-3.5" />
                  ) : showWrong ? (
                    <X className="size-3.5" />
                  ) : (
                    String.fromCharCode(65 + i)
                  )}
                </span>
                <span className="flex-1">{opt.text}</span>
              </button>
            )
          })}
        </div>

        {/* Feedback + example */}
        {answered && (
          <div className="space-y-4">
            <div
              className={cn(
                "rounded-xl border px-4 py-3",
                selected !== null && current.options[selected]?.correct
                  ? "border-[#22c55e]/30 bg-[#22c55e]/5"
                  : "border-rose-500/30 bg-rose-500/5"
              )}
            >
              <p className="text-sm font-medium">
                {selected === null
                  ? "⏱ Time's up!"
                  : current.options[selected]?.correct
                  ? "✓ Correct!"
                  : "✗ Not quite."}
              </p>
              {current.phrase.example && (
                <p className="mt-1 text-sm italic text-muted-foreground">
                  &ldquo;{current.phrase.example}&rdquo;
                </p>
              )}
            </div>

            <Button
              onClick={next}
              className="w-full gap-1.5 bg-[#22c55e] py-6 text-[#0f0f0f] hover:bg-[#22c55e]/90"
            >
              {index + 1 >= total ? "See results" : "Next"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
