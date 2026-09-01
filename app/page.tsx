import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  YOUR_WORDS,
  type Category,
  type Phrase,
  type UserProgress,
} from "@/lib/types"
import { getMasteryProgress } from "@/lib/mastery"
import { BookOpen, ArrowRight, Zap, Plus, Trophy } from "lucide-react"

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getPageData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: categories }, { data: phrases }, { data: progress }, { data: highScores }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, emoji, sort_order")
        .order("sort_order"),
      supabase.from("phrases").select("id, category_id, owner_id"),
      user
        ? supabase
            .from("user_progress")
            .select("phrase_id, status, is_favorite, updated_at")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
      user
        ? supabase
            .from("quiz_high_scores")
            .select("high_score")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ])

  const bestQuizScore = (highScores ?? []).reduce(
    (max, row) => Math.max(max, row.high_score as number),
    0
  )

  return {
    user,
    categories: (categories ?? []) as Pick<
      Category,
      "id" | "name" | "slug" | "emoji" | "sort_order"
    >[],
    phrases: (phrases ?? []) as Pick<
      Phrase,
      "id" | "category_id" | "owner_id"
    >[],
    progress: (progress ?? []) as Pick<
      UserProgress,
      "phrase_id" | "status" | "is_favorite" | "updated_at"
    >[],
    bestQuizScore,
  }
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

function buildCategoryStats(
  categories: Awaited<ReturnType<typeof getPageData>>["categories"],
  phrases: Awaited<ReturnType<typeof getPageData>>["phrases"],
  progress: Awaited<ReturnType<typeof getPageData>>["progress"]
) {
  const progressMap = new Map(progress.map((p) => [p.phrase_id, p]))

  return categories.map((cat) => {
    const catPhrases = phrases.filter((p) => p.category_id === cat.id)
    const total = catPhrases.length
    const learned = catPhrases.filter(
      (p) => progressMap.get(p.id)?.status === "learned"
    ).length
    const inProgress = catPhrases.filter(
      (p) => progressMap.get(p.id)?.status === "learning"
    ).length
    const pct = total > 0 ? Math.round((learned / total) * 100) : 0

    return { ...cat, total, learned, inProgress, pct }
  })
}

function getInProgressPhrases(
  progress: Awaited<ReturnType<typeof getPageData>>["progress"]
) {
  return progress
    .filter((p) => p.status === "learning")
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 3)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { user, categories, phrases, progress, bestQuizScore } =
    await getPageData()
  const categoryStats = buildCategoryStats(categories, phrases, progress)
  const inProgressPhrases = getInProgressPhrases(progress)
  const hasInProgress = inProgressPhrases.length > 0

  const totalLearned = progress.filter((p) => p.status === "learned").length
  const totalLearning = progress.filter((p) => p.status === "learning").length
  const totalPhrases = phrases.length
  const totalRemaining = Math.max(
    0,
    totalPhrases - totalLearned - totalLearning
  )
  const overallPct =
    totalPhrases > 0 ? Math.round((totalLearned / totalPhrases) * 100) : 0
  const learnedShare = totalPhrases > 0 ? (totalLearned / totalPhrases) * 100 : 0
  const learningShare =
    totalPhrases > 0 ? (totalLearning / totalPhrases) * 100 : 0

  const mastery = getMasteryProgress(totalLearned)
  const MasteryIcon = mastery.current.icon

  // "Your Words" stats for the grid card.
  const progressById = new Map(progress.map((p) => [p.phrase_id, p]))
  const myWords = user ? phrases.filter((p) => p.owner_id === user.id) : []
  const myLearned = myWords.filter(
    (p) => progressById.get(p.id)?.status === "learned"
  ).length
  const myPct =
    myWords.length > 0 ? Math.round((myLearned / myWords.length) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero header ── */}
      <section className="border-b border-border px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Learning Dashboard
              </p>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {user ? (
                  <>
                    Welcome back
                    {user.user_metadata?.display_name ? (
                      <span className="text-primary">
                        {", "}
                        {user.user_metadata.display_name}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    Master{" "}
                    <span className="text-primary">Business English</span>
                  </>
                )}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {user
                  ? `${totalPhrases} phrases across ${categories.length} categories`
                  : "Learn the phrases that matter in the workplace"}
              </p>
            </div>

            {!user && (
              <div className="flex gap-2 shrink-0">
                <Button asChild variant="outline" size="sm">
                  <Link href="/auth/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/signup">Get started</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Overall progress bar — learned / learning / remaining */}
          {user && totalPhrases > 0 && (
            <div className="mt-5">
              <div className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-border">
                {totalLearned > 0 && (
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${learnedShare}%` }}
                  />
                )}
                {totalLearning > 0 && (
                  <div
                    className="h-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${learningShare}%` }}
                  />
                )}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-primary">
                    {totalLearned}
                  </span>{" "}
                  learned
                </span>
                <span>
                  <span className="font-semibold text-amber-400">
                    {totalLearning}
                  </span>{" "}
                  learning
                </span>
                <span>
                  <span className="font-semibold text-foreground">
                    {totalRemaining}
                  </span>{" "}
                  remaining
                </span>
                <span>· {overallPct}% complete</span>
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8">
        {/* ── Mastery Level + Highest Quiz Score ── */}
        {user && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Word Mastery Level */}
            <Card className="border-border bg-card ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-12 shrink-0 items-center justify-center rounded-full ${mastery.current.glow}`}
                  >
                    <MasteryIcon className={`size-6 ${mastery.current.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Level {mastery.current.level} · Word Mastery
                    </p>
                    <p className={`truncate text-sm font-bold ${mastery.current.color}`}>
                      {mastery.current.title}
                    </p>
                  </div>
                </div>

                {mastery.next ? (
                  <div className="mt-3">
                    <Progress
                      value={mastery.pct}
                      className="h-1.5 bg-border [&_[data-slot=progress-indicator]]:bg-primary"
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {mastery.intoLevel}
                      </span>{" "}
                      / {mastery.levelSpan} to{" "}
                      <span className="font-medium">{mastery.next.title}</span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] font-medium text-yellow-300">
                    Max level reached — legendary status achieved
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Highest Quiz Score */}
            <Card className="border-border bg-card ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-delay:40ms]">
              <CardContent className="flex items-center gap-3 pt-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-yellow-400/15">
                  <Trophy className="size-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Highest Quiz Score
                  </p>
                  <p className="text-xl font-bold text-yellow-400">
                    {bestQuizScore > 0 ? bestQuizScore.toLocaleString() : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {bestQuizScore > 0
                      ? "Personal record"
                      : "Play Quiz to set a record"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Continue Learning ── */}
        {user && hasInProgress && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Continue Learning
              </h2>
            </div>
            <Card className="border-border bg-card ring-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                      <BookOpen className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {inProgressPhrases.length} phrase
                        {inProgressPhrases.length !== 1 ? "s" : ""} in progress
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pick up where you left off
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link
                      href={`/phrase/${inProgressPhrases[0].phrase_id}`}
                      className="gap-1.5"
                    >
                      Resume
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Category grid ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Categories
            </h2>
            {user && (
              <span className="text-xs text-muted-foreground">
                {categoryStats.filter((c) => c.pct === 100).length} /{" "}
                {categoryStats.length} complete
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {/* Your Words — only for logged-in users */}
            {user && (
              <Link href="/words" className="group">
                <Card className="h-full cursor-pointer border-primary/30 bg-primary/5 ring-0 transition-colors hover:border-primary/60 hover:bg-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <CardHeader className="pb-0">
                    <CardTitle className="mt-2 flex items-center gap-1.5 text-sm leading-snug">
                      <span className="text-2xl leading-none">
                        {YOUR_WORDS.emoji}
                      </span>
                      {YOUR_WORDS.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {myWords.length === 0
                        ? "Add your own phrases"
                        : `${myWords.length} word${myWords.length !== 1 ? "s" : ""}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3">
                    {myWords.length > 0 ? (
                      <div className="space-y-1">
                        <Progress
                          value={myPct}
                          className="h-1.5 bg-border [&_[data-slot=progress-indicator]]:bg-primary"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {myPct}%
                        </p>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        <Plus className="size-3" />
                        Create
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )}

            {categoryStats.map((cat, i) => (
              <Link
                key={cat.id}
                href={`/learn/${cat.slug}`}
                className="group animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ animationDelay: `${(user ? i + 1 : i) * 40}ms` }}
              >
                <Card className="h-full cursor-pointer border-border bg-card ring-0 transition-colors hover:border-primary/40 hover:bg-surface-hover">
                  <CardHeader className="pb-0">
                    {user && cat.pct === 100 && (
                      <div className="flex justify-end">
                        <Badge
                          variant="secondary"
                          className="shrink-0 bg-primary/10 text-primary text-[10px] px-1.5"
                        >
                          Done
                        </Badge>
                      </div>
                    )}
                    <CardTitle className="mt-2 flex items-center gap-1.5 text-sm leading-snug">
                      <span className="text-2xl leading-none">{cat.emoji}</span>
                      {cat.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {cat.total} phrase{cat.total !== 1 ? "s" : ""}
                      {user && cat.inProgress > 0 && (
                        <span className="ml-1 text-primary">
                          · {cat.inProgress} in progress
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-3">
                    {user ? (
                      <div className="space-y-1">
                        <Progress
                          value={cat.pct}
                          className="h-1.5 bg-border [&_[data-slot=progress-indicator]]:bg-primary"
                        />
                        <p className="text-right text-[10px] text-muted-foreground">
                          {cat.pct}%
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Start learning
                        <ArrowRight className="size-3" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}

            {/* New category tile */}
            {user && (
              <Link href="/categories" className="group">
                <Card className="flex h-full min-h-[7rem] cursor-pointer flex-col items-center justify-center gap-2 border-dashed border-border bg-card/50 p-4 text-center ring-0 transition-colors hover:border-primary/50 hover:bg-card">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                    <Plus className="size-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    New category
                  </p>
                </Card>
              </Link>
            )}
          </div>
        </section>

        {/* ── Guest CTA ── */}
        {!user && (
          <section>
            <Card className="border-border bg-card ring-0">
              <CardContent className="py-6">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left sm:justify-between">
                  <div>
                    <p className="font-medium">Track your progress</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Create a free account to save your learning progress.
                    </p>
                  </div>
                  <Button asChild className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Link href="/auth/signup">Sign up free</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  )
}
