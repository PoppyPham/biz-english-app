import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PhraseListClient } from "@/components/PhraseListClient"
import { Button } from "@/components/ui/button"
import { Gamepad2, ArrowLeft, Brain, Plus } from "lucide-react"
import type { Category, PhraseWithProgress, UserProgress } from "@/lib/types"

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch category
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, emoji, sort_order")
    .eq("slug", slug)
    .single()

  if (!category) notFound()

  // Fetch phrases + progress in parallel
  const [{ data: phrases }, { data: progressRows }] = await Promise.all([
    supabase
      .from("phrases")
      .select("*")
      .eq("category_id", (category as Category).id)
      .order("phrase"),
    user
      ? supabase
          .from("user_progress")
          .select("id, user_id, phrase_id, status, is_favorite, updated_at")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
  ])

  const progressMap = new Map(
    ((progressRows ?? []) as UserProgress[]).map((p) => [p.phrase_id, p])
  )

  const phrasesWithProgress: PhraseWithProgress[] = (phrases ?? []).map(
    (phrase) => ({
      ...phrase,
      progress: progressMap.get(phrase.id),
    })
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 md:top-14 z-30 border-b border-border bg-background/95 backdrop-blur">
        {/* Row 1 — back + title */}
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 pt-3 pb-2 md:px-8">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h1 className="truncate text-base font-semibold">
              {(category as Category).name}
            </h1>
            <span className="shrink-0 text-xs text-muted-foreground">
              {phrasesWithProgress.length} phrases
            </span>
          </div>
        </div>

        {/* Row 2 — action buttons */}
        <div className="mx-auto flex max-w-4xl gap-2 px-4 pb-3 md:px-8">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/games/flashcard?category=${slug}`}>
              <Gamepad2 className="size-3.5" />
              Flashcards
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={`/games/quiz?category=${slug}`}>
              <Brain className="size-3.5" />
              Quiz
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
            <Link href="/words">
              <Plus className="size-3.5" />
              Add New
            </Link>
          </Button>
        </div>
      </div>

      {/* Interactive list */}
      <PhraseListClient
        phrases={phrasesWithProgress}
        userId={user?.id ?? null}
        categorySlug={slug}
      />
    </div>
  )
}
