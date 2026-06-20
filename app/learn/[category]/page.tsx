import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PhraseListClient } from "@/components/PhraseListClient"
import { Button } from "@/components/ui/button"
import { Gamepad2, ArrowLeft } from "lucide-react"
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
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <div className="sticky top-0 md:top-14 z-30 border-b border-[#2a2a2a] bg-[#0f0f0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 md:px-8">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-xl leading-none">{(category as Category).emoji}</span>
            <h1 className="truncate text-base font-semibold">
              {(category as Category).name}
            </h1>
            <span className="shrink-0 text-xs text-muted-foreground">
              {phrasesWithProgress.length} phrases
            </span>
          </div>

          <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
            <Link href={`/games/flashcard?category=${slug}`}>
              <Gamepad2 className="size-3.5" />
              <span className="hidden sm:inline">Flashcards</span>
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
