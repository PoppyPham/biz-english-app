import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { FlashcardGame } from "@/components/FlashcardGame"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { Category, Phrase } from "@/lib/types"

export default async function FlashcardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category: slug } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Resolve category (optional)
  let category: Category | null = null
  if (slug) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug, emoji, sort_order")
      .eq("slug", slug)
      .single()
    category = (data as Category) ?? null
  }

  // Fetch phrases — scoped to category if provided, else all
  let query = supabase
    .from("phrases")
    .select("id, phrase, definition, example, category_id")
  if (category) query = query.eq("category_id", category.id)
  const { data: phrases } = await query

  const list = (phrases ?? []) as Phrase[]

  // Empty state
  if (list.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] px-4 text-center">
        <p className="text-4xl">🃏</p>
        <p className="text-lg font-medium">No phrases to study</p>
        <p className="text-sm text-muted-foreground">
          {category
            ? `The "${category.name}" category has no phrases yet.`
            : "There are no phrases available yet."}
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
    <FlashcardGame
      phrases={list}
      userId={user?.id ?? null}
      categoryName={category?.name ?? "All categories"}
      categorySlug={category?.slug ?? null}
    />
  )
}
