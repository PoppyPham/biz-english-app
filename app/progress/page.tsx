import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import {
  GraduationCap,
  Heart,
  Flame,
  Target,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import {
  YOUR_WORDS,
  type Category,
  type Phrase,
  type UserProgress,
} from "@/lib/types"

// Count consecutive activity days ending today (or yesterday — grace period).
function computeStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0

  const dayMs = 86_400_000
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const today = new Date()
  const todayKey = fmt(today)
  const yesterdayKey = fmt(new Date(today.getTime() - dayMs))

  // Anchor on today if active, else yesterday, else streak is broken.
  let cursor: Date
  if (dates.has(todayKey)) cursor = today
  else if (dates.has(yesterdayKey)) cursor = new Date(today.getTime() - dayMs)
  else return 0

  let streak = 0
  while (dates.has(fmt(cursor))) {
    streak++
    cursor = new Date(cursor.getTime() - dayMs)
  }
  return streak
}

export default async function ProgressPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?message=Login%20to%20track%20progress")
  }

  const [{ data: categories }, { data: phrases }, { data: progressRows }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, emoji, sort_order")
        .order("sort_order"),
      supabase
        .from("phrases")
        .select("id, phrase, definition, example, category_id, owner_id"),
      supabase
        .from("user_progress")
        .select("id, user_id, phrase_id, status, is_favorite, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
    ])

  const cats = (categories ?? []) as Category[]
  const allPhrases = (phrases ?? []) as Phrase[]
  const progress = (progressRows ?? []) as UserProgress[]

  const phraseMap = new Map(allPhrases.map((p) => [p.id, p]))
  const progressMap = new Map(progress.map((p) => [p.phrase_id, p]))

  // ── Overall stats ──
  const totalPhrases = allPhrases.length
  const totalLearned = progress.filter((p) => p.status === "learned").length
  const totalFavorites = progress.filter((p) => p.is_favorite).length
  const pctComplete =
    totalPhrases > 0 ? Math.round((totalLearned / totalPhrases) * 100) : 0
  const streak = computeStreak(
    new Set(progress.map((p) => p.updated_at.slice(0, 10)))
  )

  // ── Category breakdown ──
  function tally(phrasesSubset: Phrase[]) {
    let learned = 0
    let learning = 0
    for (const p of phrasesSubset) {
      const s = progressMap.get(p.id)?.status
      if (s === "learned") learned++
      else if (s === "learning") learning++
    }
    return {
      total: phrasesSubset.length,
      learned,
      learning,
      newCount: phrasesSubset.length - learned - learning,
    }
  }

  const breakdown = cats.map((cat) => ({
    id: String(cat.id),
    name: cat.name,
    emoji: cat.emoji,
    href: `/learn/${cat.slug}`,
    ...tally(allPhrases.filter((p) => p.category_id === cat.id)),
  }))

  // Prepend "Your Words" (user's own phrases) if they have any.
  const myWords = allPhrases.filter((p) => p.owner_id === user.id)
  if (myWords.length > 0) {
    breakdown.unshift({
      id: YOUR_WORDS.slug,
      name: YOUR_WORDS.name,
      emoji: YOUR_WORDS.emoji,
      href: "/words",
      ...tally(myWords),
    })
  }

  // ── Recently studied (last 10) ──
  const recent = progress
    .slice(0, 10)
    .map((p) => ({ progress: p, phrase: phraseMap.get(p.phrase_id) }))
    .filter((r): r is { progress: UserProgress; phrase: Phrase } => !!r.phrase)

  // ── Favorites ──
  const favorites = progress
    .filter((p) => p.is_favorite)
    .map((p) => phraseMap.get(p.phrase_id))
    .filter((p): p is Phrase => !!p)

  // ── Keep going: phrases that are still "new" (status new or untouched) ──
  const suggestions = allPhrases
    .filter((p) => {
      const s = progressMap.get(p.id)?.status
      return s === "new" || s === undefined
    })
    .slice(0, 5)

  const statusStyles: Record<string, string> = {
    learned: "bg-[#22c55e]",
    learning: "bg-amber-400",
    new: "bg-[#2a2a2a]",
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-8 md:px-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Your Progress
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep up the momentum — every phrase counts.
          </p>
        </header>

        {/* ── 1. Overall stats strip ── */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            icon={<GraduationCap className="size-4" />}
            label="Learned"
            value={totalLearned}
            accent="text-[#22c55e]"
          />
          <StatCard
            icon={<Heart className="size-4" />}
            label="Favorites"
            value={totalFavorites}
            accent="text-rose-400"
          />
          <StatCard
            icon={<Flame className="size-4" />}
            label="Day streak"
            value={streak}
            accent="text-amber-400"
          />
          <StatCard
            icon={<Target className="size-4" />}
            label="Complete"
            value={`${pctComplete}%`}
            accent="text-[#22c55e]"
          />
        </section>

        {/* ── 2. Category breakdown ── */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Category breakdown
          </h2>
          <div className="space-y-4">
            {breakdown.map((cat) => (
              <div key={cat.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <Link
                    href={cat.href}
                    className="flex items-center gap-2 hover:underline underline-offset-2"
                  >
                    <span>{cat.emoji}</span>
                    <span className="font-medium">{cat.name}</span>
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {cat.learned}/{cat.total}
                  </span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
                  {cat.total > 0 ? (
                    <>
                      <Bar n={cat.learned} total={cat.total} cls={statusStyles.learned} />
                      <Bar n={cat.learning} total={cat.total} cls={statusStyles.learning} />
                      <Bar n={cat.newCount} total={cat.total} cls={statusStyles.new} />
                    </>
                  ) : (
                    <div className="h-full w-full bg-[#1a1a1a]" />
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <LegendDot cls={statusStyles.learned} label="Learned" />
            <LegendDot cls={statusStyles.learning} label="Learning" />
            <LegendDot cls={statusStyles.new} label="New" />
          </div>
        </section>

        {/* ── 3. Recently studied ── */}
        {recent.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3.5" />
              Recently studied
            </h2>
            <div className="divide-y divide-[#2a2a2a] overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
              {recent.map(({ progress: pr, phrase }) => (
                <Link
                  key={pr.id}
                  href={`/phrase/${phrase.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[#1e1e1e]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {phrase.phrase}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      pr.status === "learned" &&
                        "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]",
                      pr.status === "learning" &&
                        "border-amber-500/40 bg-amber-500/10 text-amber-400",
                      pr.status === "new" &&
                        "border-[#2a2a2a] text-muted-foreground"
                    )}
                  >
                    {pr.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── 4. Favorites ── */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Heart className="size-3.5" />
            Favorites
          </h2>
          {favorites.length === 0 ? (
            <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-6 text-center text-sm text-muted-foreground">
              No favorites yet. Tap the ♥ on any phrase to save it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {favorites.map((p) => (
                <Link
                  key={p.id}
                  href={`/phrase/${p.id}`}
                  className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 transition-colors hover:border-rose-500/30 hover:bg-[#1e1e1e]"
                >
                  <p className="font-medium leading-snug">{p.phrase}</p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {p.definition}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── 5. Keep going ── */}
        {suggestions.length > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 text-[#22c55e]" />
              Keep going
            </h2>
            <div className="space-y-2">
              {suggestions.map((p) => (
                <Link
                  key={p.id}
                  href={`/phrase/${p.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 transition-colors hover:border-[#22c55e]/30 hover:bg-[#1e1e1e]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.phrase}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.definition}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-[#22c55e]" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ── Small presentational helpers ──

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <div className={cn("flex items-center gap-1.5", accent)}>
        {icon}
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function Bar({ n, total, cls }: { n: number; total: number; cls: string }) {
  if (n <= 0) return null
  return (
    <div
      className={cn("h-full", cls)}
      style={{ width: `${(n / total) * 100}%` }}
    />
  )
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", cls)} />
      {label}
    </span>
  )
}
