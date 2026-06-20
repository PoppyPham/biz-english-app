import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { FlashcardGame } from "@/components/FlashcardGame"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { YOUR_WORDS, type Category, type Phrase } from "@/lib/types"

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

  const isYourWords = slug === YOUR_WORDS.slug

  // Resolve a real category (skipped for the virtual "Your Words").
  let category: Category | null = null
  if (slug && !isYourWords) {
    const { data } = await supabase
      .from("categories")
      .select("id, name, slug, emoji, sort_order")
      .eq("slug", slug)
      .single()
    category = (data as Category) ?? null
  }

  // Fetch phrases — by owner (Your Words), by category, or all.
  let query = supabase.from("phrases").select("*")
  if (isYourWords && user) query = query.eq("owner_id", user.id)
  else if (category) query = query.eq("category_id", category.id)
  const { data: phrases } = await query

  const list = (phrases ?? []) as Phrase[]

  const gameName = isYourWords ? YOUR_WORDS.name : category?.name ?? "All categories"
  const gameSlug = isYourWords ? YOUR_WORDS.slug : category?.slug ?? null
  const backHref = isYourWords ? "/words" : category ? `/learn/${category.slug}` : "/"

  // Empty state
  if (list.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0f0f0f] px-4 text-center">
        <p className="text-4xl">🃏</p>
        <p className="text-lg font-medium">No phrases to study</p>
        <p className="text-sm text-muted-foreground">
          {isYourWords
            ? "You haven't added any words yet."
            : category
            ? `The "${category.name}" category has no phrases yet.`
            : "There are no phrases available yet."}
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
    <FlashcardGame
      phrases={list}
      userId={user?.id ?? null}
      categoryName={gameName}
      categorySlug={gameSlug}
    />
  )
}
