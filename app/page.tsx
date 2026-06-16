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
import type { Category, Phrase, UserProgress } from "@/lib/types"
import { BookOpen, ArrowRight, Zap } from "lucide-react"

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getPageData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: categories }, { data: phrases }, { data: progress }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, emoji, sort_order")
        .order("sort_order"),
      supabase.from("phrases").select("id, category_id"),
      user
        ? supabase
            .from("user_progress")
            .select("phrase_id, status, is_favorite, updated_at")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ])

  return {
    user,
    categories: (categories ?? []) as Pick<
      Category,
      "id" | "name" | "slug" | "emoji" | "sort_order"
    >[],
    phrases: (phrases ?? []) as Pick<Phrase, "id" | "category_id">[],
    progress: (progress ?? []) as Pick<
      UserProgress,
      "phrase_id" | "status" | "is_favorite" | "updated_at"
    >[],
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
  const { user, categories, phrases, progress } = await getPageData()
  const categoryStats = buildCategoryStats(categories, phrases, progress)
  const inProgressPhrases = getInProgressPhrases(progress)
  const hasInProgress = inProgressPhrases.length > 0

  const totalLearned = progress.filter((p) => p.status === "learned").length
  const totalPhrases = phrases.length
  const overallPct =
    totalPhrases > 0 ? Math.round((totalLearned / totalPhrases) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* ── Hero header ── */}
      <section className="border-b border-[#2a2a2a] px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {user ? (
                  <>
                    Welcome back
                    {user.user_metadata?.display_name ? (
                      <span className="text-[#22c55e]">
                        {", "}
                        {user.user_metadata.display_name}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    Master{" "}
                    <span className="text-[#22c55e]">Business English</span>
                  </>
                )}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {user
                  ? `${totalLearned} of ${totalPhrases} phrases learned · ${overallPct}% complete`
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

          {/* Overall progress bar — only when logged in */}
          {user && totalPhrases > 0 && (
            <div className="mt-5">
              <Progress
                value={overallPct}
                className="h-2 bg-[#2a2a2a] [&_[data-slot=progress-indicator]]:bg-[#22c55e]"
              />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8">
        {/* ── Continue Learning ── */}
        {user && hasInProgress && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="size-4 text-[#22c55e]" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Continue Learning
              </h2>
            </div>
            <Card className="border-[#2a2a2a] bg-[#1a1a1a] ring-0">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-[#22c55e]/10">
                      <BookOpen className="size-4 text-[#22c55e]" />
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
                    <Link href="/learn" className="gap-1.5">
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
            {categoryStats.map((cat) => (
              <Link key={cat.id} href={`/learn/${cat.slug}`} className="group">
                <Card className="h-full cursor-pointer border-[#2a2a2a] bg-[#1a1a1a] ring-0 transition-colors hover:border-[#22c55e]/40 hover:bg-[#1e1e1e]">
                  <CardHeader className="pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl leading-none">{cat.emoji}</span>
                      {user && cat.pct === 100 && (
                        <Badge
                          variant="secondary"
                          className="shrink-0 bg-[#22c55e]/10 text-[#22c55e] text-[10px] px-1.5"
                        >
                          Done
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-2 text-sm leading-snug">
                      {cat.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {cat.total} phrase{cat.total !== 1 ? "s" : ""}
                      {user && cat.inProgress > 0 && (
                        <span className="ml-1 text-[#22c55e]">
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
                          className="h-1.5 bg-[#2a2a2a] [&_[data-slot=progress-indicator]]:bg-[#22c55e]"
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
          </div>
        </section>

        {/* ── Guest CTA ── */}
        {!user && (
          <section>
            <Card className="border-[#2a2a2a] bg-[#1a1a1a] ring-0">
              <CardContent className="py-6">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left sm:justify-between">
                  <div>
                    <p className="font-medium">Track your progress</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Create a free account to save your learning progress.
                    </p>
                  </div>
                  <Button asChild className="shrink-0 bg-[#22c55e] text-[#0f0f0f] hover:bg-[#22c55e]/90">
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
