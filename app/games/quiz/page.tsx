import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { QuizGame } from "@/components/QuizGame"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { YOUR_WORDS, type Category, type Phrase } from "@/lib/types"

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category: slug } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isYourWords = slug === YOUR_WORDS.slug

  let category: Category | null = null
  if (slug && !isYourWords) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug, emoji, sort_order")
      .eq("slug", slug)
      .single()
    category = (data as Category) ?? null
  }

  let query = supabase
    .from("phrases")
    .select("id, phrase, definition, example, category_id")
  if (isYourWords && user) query = query.eq("owner_id", user.id)
  else if (category) query = query.eq("category_id", category.id)
  const { data: phrases } = await query

  const list = (phrases ?? []) as Phrase[]

  const gameName = isYourWords ? YOUR_WORDS.name : category?.name ?? "All categories"
  const gameSlug = isYourWords ? YOUR_WORDS.slug : category?.slug ?? null
  const backHref = isYourWords ? "/words" : category ? `/learn/${category.slug}` : "/"

  // Need at least 4 phrases to build a 4-option question
  if (list.length < 4) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] px-4 text-center">
        <p className="text-4xl">🧠</p>
        <p className="text-lg font-medium">Not enough phrases for a quiz</p>
        <p className="text-sm text-muted-foreground">
          {isYourWords
            ? "Add at least 4 of your own words to quiz them."
            : category
            ? `"${category.name}" needs at least 4 phrases to build a quiz.`
            : "You need at least 4 phrases to start a quiz."}
        </p>
        <Button asChild variant="outline" className="mt-2 gap-1.5">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {isYourWords ? "Add words" : category ? "Back to category" : "Back home"}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <QuizGame
      phrases={list}
      userId={user?.id ?? null}
      categoryName={gameName}
      categorySlug={gameSlug}
    />
  )
}
