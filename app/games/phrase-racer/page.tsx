import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { PhraseRacerGame } from "@/components/PhraseRacerGame"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { YOUR_WORDS, type Category, type Phrase } from "@/lib/types"
import { buildRacerDeck } from "@/lib/phraseRacer"

export default async function PhraseRacerPage({
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

  let query = supabase.from("phrases").select("*")
  if (isYourWords && user) query = query.eq("owner_id", user.id)
  else if (category) query = query.eq("category_id", category.id)
  const { data: phrases } = await query

  const list = (phrases ?? []) as Phrase[]
  const deck = buildRacerDeck(list)

  const gameName = isYourWords ? YOUR_WORDS.name : category?.name ?? "All categories"
  const gameSlug = isYourWords ? YOUR_WORDS.slug : category?.slug ?? null
  const backHref = isYourWords ? "/words" : category ? `/learn/${category.slug}` : "/games"

  // Need at least 3 phrases whose example sentence actually contains the
  // phrase text (buildRacerDeck skips ones that don't).
  if (deck.length < 3) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-4xl">🏎️</p>
        <p className="text-lg font-medium">Not enough phrases for Phrase Racer</p>
        <p className="text-sm text-muted-foreground">
          {isYourWords
            ? "Add at least 3 of your own words with example sentences to race them."
            : category
            ? `"${category.name}" needs at least 3 phrases with a matching example sentence.`
            : "You need at least 3 phrases with example sentences to start."}
        </p>
        <Button asChild variant="outline" className="mt-2 gap-1.5">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {isYourWords ? "Add words" : category ? "Back to category" : "Back to Games"}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <PhraseRacerGame
      questions={deck}
      userId={user?.id ?? null}
      categoryName={gameName}
      categorySlug={gameSlug}
      backHref={backHref}
    />
  )
}
