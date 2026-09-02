import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Layers, ListChecks, ArrowRight, Rocket } from "lucide-react"
import { YOUR_WORDS, type Category } from "@/lib/types"

export default async function GamesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: categories }, { count: myWordCount }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, emoji, sort_order")
      .order("sort_order"),
    user
      ? supabase
          .from("phrases")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
      : Promise.resolve({ count: 0 }),
  ])

  const cats = (categories ?? []) as Category[]
  const hasMyWords = (myWordCount ?? 0) > 0

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-8 md:px-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Games
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Practice and test yourself across all phrases.
          </p>
        </header>

        {/* ── Play all categories ── */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/games/flashcard"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-surface-hover"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
              <Layers className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Flashcards</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Flip cards, mark what you know. Self-paced review.
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1 text-sm text-primary">
              Play all
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/games/quiz"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-surface-hover"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
              <ListChecks className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Quiz</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Multiple choice. Score points and earn stars.
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1 text-sm text-primary">
              Play all
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <a
            href="/games/phrase-racer/index.html"
            target="_blank"
            rel="noopener"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-surface-hover"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
              <Rocket className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold">Phrase Racer</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Race against the clock. Fill in phrases before you crash.
              </p>
            </div>
            <span className="mt-1 flex items-center gap-1 text-sm text-primary">
              Play
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>
        </section>

        {/* ── Practice by category ── */}
        {cats.length > 0 && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Practice a category
            </h2>
            <div className="space-y-2">
              {/* Your Words row */}
              {hasMyWords && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-xl leading-none">{YOUR_WORDS.emoji}</span>
                    <span className="truncate text-sm font-medium">
                      {YOUR_WORDS.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {myWordCount}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/games/flashcard?category=${YOUR_WORDS.slug}`}
                      className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Flashcards
                    </Link>
                    <Link
                      href={`/games/quiz?category=${YOUR_WORDS.slug}`}
                      className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      Quiz
                    </Link>
                  </div>
                </div>
              )}

              {cats.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span className="truncate text-sm font-medium">
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/games/flashcard?category=${cat.slug}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      Flashcards
                    </Link>
                    <Link
                      href={`/games/quiz?category=${cat.slug}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      Quiz
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
