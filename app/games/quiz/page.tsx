import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { QuizGame } from "@/components/QuizGame"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { Category, Phrase } from "@/lib/types"

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

  let category: Category | null = null
  if (slug) {
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
  if (category) query = query.eq("category_id", category.id)
  const { data: phrases } = await query

  const list = (phrases ?? []) as Phrase[]

  // Need at least 4 phrases to build a 4-option question
  if (list.length < 4) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] px-4 text-center">
        <p className="text-4xl">🧠</p>
        <p className="text-lg font-medium">Not enough phrases for a quiz</p>
        <p className="text-sm text-muted-foreground">
          {category
            ? `"${category.name}" needs at least 4 phrases to build a quiz.`
            : "You need at least 4 phrases to start a quiz."}
        </p>
        <Button asChild variant="outline" className="mt-2 gap-1.5">
          <Link href={category ? `/learn/${category.slug}` : "/"}>
            <ArrowLeft className="size-4" />
            {category ? "Back to category" : "Back home"}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <QuizGame
      phrases={list}
      userId={user?.id ?? null}
      categoryName={category?.name ?? "All categories"}
      categorySlug={category?.slug ?? null}
    />
  )
}
