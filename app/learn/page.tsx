import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Progress } from "@/components/ui/progress"
import { ArrowRight, Plus } from "lucide-react"
import { YOUR_WORDS, type Category, type Phrase, type UserProgress } from "@/lib/types"

export default async function LearnPage() {
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
      supabase.from("phrases").select("id, category_id, owner_id"),
      user
        ? supabase
            .from("user_progress")
            .select("phrase_id, status")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ])

  const cats = (categories ?? []) as Category[]
  const allPhrases = (phrases ?? []) as Pick<
    Phrase,
    "id" | "category_id" | "owner_id"
  >[]
  const progressMap = new Map(
    ((progress ?? []) as Pick<UserProgress, "phrase_id" | "status">[]).map(
      (p) => [p.phrase_id, p.status]
    )
  )

  const stats = cats.map((cat) => {
    const catPhrases = allPhrases.filter((p) => p.category_id === cat.id)
    const total = catPhrases.length
    const learned = catPhrases.filter(
      (p) => progressMap.get(p.id) === "learned"
    ).length
    const pct = total > 0 ? Math.round((learned / total) * 100) : 0
    return { ...cat, total, learned, pct }
  })

  // "Your Words" — the user's own phrases (owner_id = me).
  const myWords = user
    ? allPhrases.filter((p) => p.owner_id === user.id)
    : []
  const myLearned = myWords.filter(
    (p) => progressMap.get(p.id) === "learned"
  ).length
  const myPct =
    myWords.length > 0 ? Math.round((myLearned / myWords.length) * 100) : 0

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Learn
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a category to start studying phrases.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {/* Your Words — only for logged-in users */}
          {user && (
            <Link href="/words" className="group">
              <div className="flex h-full flex-col gap-3 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/5 p-4 transition-colors hover:border-[#22c55e]/60 hover:bg-[#22c55e]/10">
                <span className="text-2xl leading-none">{YOUR_WORDS.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-snug">
                    {YOUR_WORDS.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {myWords.length === 0
                      ? "Add your own"
                      : `${myWords.length} word${myWords.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                {myWords.length > 0 ? (
                  <div className="space-y-1">
                    <Progress
                      value={myPct}
                      className="h-1.5 bg-[#2a2a2a] [&_[data-slot=progress-indicator]]:bg-[#22c55e]"
                    />
                    <p className="text-right text-[10px] text-muted-foreground">
                      {myLearned}/{myWords.length}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-[#22c55e]">
                    <Plus className="size-3" />
                    Create
                  </div>
                )}
              </div>
            </Link>
          )}

          {stats.map((cat) => (
            <Link key={cat.id} href={`/learn/${cat.slug}`} className="group">
              <div className="flex h-full flex-col gap-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4 transition-colors hover:border-[#22c55e]/40 hover:bg-[#1e1e1e]">
                <span className="text-2xl leading-none">{cat.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-snug">{cat.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cat.total} phrase{cat.total !== 1 ? "s" : ""}
                  </p>
                </div>

                {user ? (
                  <div className="space-y-1">
                    <Progress
                      value={cat.pct}
                      className="h-1.5 bg-[#2a2a2a] [&_[data-slot=progress-indicator]]:bg-[#22c55e]"
                    />
                    <p className="text-right text-[10px] text-muted-foreground">
                      {cat.learned}/{cat.total}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                    Start
                    <ArrowRight className="size-3" />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
