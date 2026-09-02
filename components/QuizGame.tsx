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
  Heart,
  Flame,
  Trophy,
  Share2,
  RotateCcw,
  Timer,
} from "lucide-react"
import { Ipa } from "@/components/Ipa"
import { SpeakButton } from "@/components/SpeakButton"
import { SoundToggle } from "@/components/SoundToggle"
import {
  playStreak,
  playLifeLost,
  playExtraLife,
  playGameOver,
  playHighScore,
} from "@/lib/sounds"
import { speakText } from "@/lib/speak"
import { ExampleQuote } from "@/components/ExampleQuote"
import type { Phrase } from "@/lib/types"

const TIMER_SECONDS = 20
const STARTING_LIVES = 3
const STREAK_FOR_BONUS_LIFE = 10
const POINTS_CORRECT = 5
const POINTS_WRONG = 5

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

// One shuffled pass through the whole phrase pool — a "deck". Appended
// again (reshuffled) whenever it runs out, so the quiz never ends on its
// own; only running out of lives ends it.
function buildDeck(phrases: Phrase[]): Question[] {
  return shuffle(phrases).map((phrase) => {
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
  const scope = categorySlug ?? "all"

  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [done, setDone] = useState(false)

  // Score / lives / streak
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [lifeBonusFlash, setLifeBonusFlash] = useState(false)
  const [lostLifeFlash, setLostLifeFlash] = useState(false)
  const [popup, setPopup] = useState<{ key: number; delta: number } | null>(null)
  const popupKey = useRef(0)

  // High score
  const [highScore, setHighScore] = useState<number | null>(null)
  const [isNewHighScore, setIsNewHighScore] = useState(false)
  const [highScoreSaveError, setHighScoreSaveError] = useState(false)

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS)

  // Share feedback
  const [shareLabel, setShareLabel] = useState("Share result")

  const backHref = categorySlug ? `/learn/${categorySlug}` : "/"

  // Build the first deck on mount (client-only → no hydration mismatch)
  useEffect(() => {
    setQuestions(buildDeck(phrases))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases])

  // Load this user's high score for this scope
  useEffect(() => {
    if (!userId) {
      setHighScore(0)
      return
    }
    let cancelled = false
    const supabase = createClient()
    supabase
      .from("quiz_high_scores")
      .select("high_score")
      .eq("user_id", userId)
      .eq("scope", scope)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setHighScore((data as { high_score: number } | null)?.high_score ?? 0)
      })
    return () => {
      cancelled = true
    }
  }, [userId, scope])

  const current = questions[index]

  // Auto-pronounce the phrase the moment a new question appears — same as
  // the flashcard game — so the user hears it without having to tap the
  // speaker icon first.
  useEffect(() => {
    if (current) speakText(current.phrase.phrase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

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

  function triggerPopup(delta: number) {
    popupKey.current += 1
    setPopup({ key: popupKey.current, delta })
  }

  // Mirrors `answered` but read/written synchronously and independent of
  // any closure — a stray duplicate timer (e.g. left over from a hot
  // reload) can still be holding a stale closure where `answered` was
  // captured as `false`, which would let it slip past a plain state check
  // and silently skip a question out from under the player. A ref can't
  // go stale like that, since it's the same mutable object every call
  // reads from.
  const answeredRef = useRef(false)

  const handleAnswer = useCallback(
    (optionIdx: number | null) => {
      if (answeredRef.current || !current || done) return
      answeredRef.current = true
      setAnswered(true)
      setSelected(optionIdx)
      const correct =
        optionIdx !== null && current.options[optionIdx]?.correct === true

      setAnsweredCount((c) => c + 1)

      if (correct) {
        setCorrectCount((c) => c + 1)
        setScore((s) => s + POINTS_CORRECT)
        triggerPopup(POINTS_CORRECT)
        setStreak((s) => s + 1)
      } else {
        setScore((s) => Math.max(0, s - POINTS_WRONG))
        triggerPopup(-POINTS_WRONG)
        setStreak(0)
        setLives((l) => Math.max(0, l - 1))
        setLostLifeFlash(true)
        setTimeout(() => setLostLifeFlash(false), 500)
        playLifeLost()
      }
      void saveResult(current.phrase.id, correct)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, done]
  )

  // Game-over side effects: high score save/fanfare, or a game-over tone.
  useEffect(() => {
    if (!done) return
    const beatHighScore = !!userId && score > (highScore ?? 0)
    if (beatHighScore) {
      // Celebrate immediately — don't gate the dopamine hit on network
      // latency. If the save turns out to fail, we surface that separately
      // rather than silently losing the score.
      setIsNewHighScore(true)
      setHighScore(score)
      playHighScore()
      const supabase = createClient()
      supabase
        .from("quiz_high_scores")
        .upsert(
          { user_id: userId, scope, high_score: score },
          { onConflict: "user_id,scope" }
        )
        .then(({ error }) => {
          if (error) {
            console.error("Failed to save quiz high score:", error)
            setHighScoreSaveError(true)
          }
        })
    } else {
      playGameOver()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  // Streak-bonus side effects (best-streak tracking, the bonus life every
  // Nth correct answer in a row, and the combo chime otherwise). Kept as
  // an effect reacting to `streak` — rather than inline inside the
  // `setStreak` updater in handleAnswer — because React (in development)
  // can invoke a state updater function more than once per call to help
  // catch impure updaters; an updater that also calls setLives/plays a
  // sound isn't safe to double-invoke; a `useEffect` keyed on the
  // resulting value only ever fires once per actual change.
  const prevStreakRef = useRef(0)
  useEffect(() => {
    if (streak > prevStreakRef.current) {
      setBestStreak((b) => Math.max(b, streak))
      if (streak % STREAK_FOR_BONUS_LIFE === 0) {
        setLives((l) => l + 1)
        setLifeBonusFlash(true)
        setTimeout(() => setLifeBonusFlash(false), 1800)
        playExtraLife()
      } else {
        playStreak(streak)
      }
    }
    prevStreakRef.current = streak
  }, [streak])

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
    if (lives <= 0) {
      setDone(true)
      return
    }
    // Keep the deck topped up so the quiz never runs out on its own.
    if (index + 1 >= questions.length) {
      setQuestions((qs) => {
        let more = buildDeck(phrases)
        // avoid an immediate repeat right at the seam between decks
        if (
          more.length > 1 &&
          more[0].phrase.id === qs[qs.length - 1]?.phrase.id
        ) {
          ;[more[0], more[1]] = [more[1], more[0]]
        }
        return [...qs, ...more]
      })
    }
    setIndex((i) => i + 1)
    setSelected(null)
    answeredRef.current = false
    setAnswered(false)
    setTimeLeft(TIMER_SECONDS)
  }

  function restart() {
    setQuestions(buildDeck(phrases))
    setIndex(0)
    setSelected(null)
    answeredRef.current = false
    setAnswered(false)
    setScore(0)
    setLives(STARTING_LIVES)
    setStreak(0)
    setBestStreak(0)
    setCorrectCount(0)
    setAnsweredCount(0)
    setIsNewHighScore(false)
    setHighScoreSaveError(false)
    setDone(false)
    setTimeLeft(TIMER_SECONDS)
  }

  async function share(accuracy: number) {
    const text = isNewHighScore
      ? `New high score of ${score} on the BizEnglish ${categoryName} quiz! 🏆`
      : `I scored ${score} points (${accuracy}% accuracy, ${bestStreak}-streak) on the BizEnglish ${categoryName} quiz!`
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
  if (questions.length === 0 || highScore === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  // ── End screen ──
  if (done) {
    const accuracy =
      answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        {isNewHighScore ? (
          <div className="flex flex-col items-center gap-2 animate-in zoom-in-50 fade-in duration-500">
            <Trophy className="size-12 text-amber-400" />
            <h1 className="text-2xl font-bold tracking-tight text-amber-400">
              New high score! 🎉
            </h1>
          </div>
        ) : (
          <h1 className="text-2xl font-bold tracking-tight">
            Game over — out of lives 💔
          </h1>
        )}

        <div className="flex flex-col items-center gap-1">
          <p className="text-5xl font-bold">
            <span className={isNewHighScore ? "text-amber-400" : "text-primary"}>
              {score}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">points</p>
          {userId && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Trophy className="size-3" />
              Best: {highScore}
            </p>
          )}
          {!userId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Sign in to save your high score.
            </p>
          )}
          {highScoreSaveError && (
            <p className="mt-1 text-xs text-rose-400">
              Couldn&apos;t save your score — check your connection and try
              again.
            </p>
          )}
        </div>

        <div className="flex gap-6 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-primary">{accuracy}%</span>
            <span className="text-xs text-muted-foreground">Accuracy</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="flex items-center gap-1 text-xl font-bold text-amber-400">
              <Flame className="size-4" />
              {bestStreak}
            </span>
            <span className="text-xs text-muted-foreground">Best streak</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold">{answeredCount}</span>
            <span className="text-xs text-muted-foreground">Questions</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => share(accuracy)}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
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
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Bonus-life celebration banner */}
      {lifeBonusFlash && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary shadow-lg backdrop-blur">
            <Heart className="size-4 fill-primary" />
            +1 Life! {streak}-streak bonus
          </div>
        </div>
      )}

      {/* Top bar */}
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
        </div>

        {/* Score / streak / lives HUD */}
        <div className="mx-auto mt-3 flex max-w-2xl items-center justify-between gap-3">
          <div className="relative flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-primary">
              {score}
            </span>
            <span className="text-xs text-muted-foreground">
              · best {highScore}
            </span>
            {popup && (
              <span
                key={popup.key}
                onAnimationEnd={() => setPopup(null)}
                className={cn(
                  "pointer-events-none absolute -top-1 left-full ml-1 text-base font-bold animate-float-up",
                  popup.delta > 0 ? "text-primary" : "text-rose-400"
                )}
              >
                {popup.delta > 0 ? `+${popup.delta}` : popup.delta}
              </span>
            )}
          </div>

          {streak >= 2 && (
            <div
              key={streak}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold animate-pop-in",
                streak >= 10
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                  : streak >= 5
                  ? "border-orange-400/50 bg-orange-400/10 text-orange-400"
                  : "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              <Flame className="size-3.5" />
              {streak} streak
            </div>
          )}

          <div
            className={cn(
              "flex items-center gap-1",
              lostLifeFlash && "animate-shake"
            )}
          >
            {Array.from({ length: lives }).map((_, i) => (
              <Heart key={i} className="size-4 fill-rose-500 text-rose-500" />
            ))}
          </div>
        </div>
      </div>

      {/* Timer bar + toggle */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-3 md:px-0">
        <div className="flex items-center gap-3">
          <Timer className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-card">
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
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <Ipa
              phraseId={current.phrase.id}
              text={current.phrase.phrase}
              initialIpa={current.phrase.ipa}
              className="text-sm"
            />
            <SpeakButton text={current.phrase.phrase} />
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
                    "border-border bg-card hover:border-border-hover hover:bg-surface-hover",
                  showCorrect &&
                    "border-primary/50 bg-primary/10 text-primary animate-in fade-in zoom-in-95 duration-300",
                  showWrong &&
                    "border-rose-500/50 bg-rose-500/10 text-rose-400 animate-in fade-in duration-200 animate-shake",
                  answered &&
                    !showCorrect &&
                    !showWrong &&
                    "border-border bg-card opacity-50"
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    showCorrect && "border-primary bg-primary text-primary-foreground",
                    showWrong && "border-rose-500 bg-rose-500 text-white",
                    !showCorrect &&
                      !showWrong &&
                      "border-border text-muted-foreground"
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
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
              className={cn(
                "rounded-xl border px-4 py-3",
                selected !== null && current.options[selected]?.correct
                  ? "border-primary/30 bg-primary/5"
                  : "border-rose-500/30 bg-rose-500/5"
              )}
            >
              <p className="text-sm font-medium">
                {selected === null
                  ? "⏱ Time's up!"
                  : current.options[selected]?.correct
                  ? `✓ Correct! +${POINTS_CORRECT}`
                  : `✗ Not quite. -${POINTS_WRONG}`}
              </p>
              {current.phrase.example && (
                <ExampleQuote
                  text={current.phrase.example}
                  className="mt-1"
                  lineClassName="text-sm italic text-muted-foreground"
                />
              )}
            </div>

            <Button
              onClick={next}
              className="w-full gap-1.5 bg-primary py-6 text-primary-foreground hover:bg-primary/90"
            >
              {lives <= 0 ? "See results" : "Next"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
