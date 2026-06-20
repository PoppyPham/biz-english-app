import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MyWordsClient } from "@/components/MyWordsClient"
import { ArrowLeft } from "lucide-react"
import { YOUR_WORDS, type Phrase } from "@/lib/types"

export default async function MyWordsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?message=Login%20to%20manage%20your%20words")
  }

  const { data: words } = await supabase
    .from("phrases")
    .select(
      "id, phrase, definition, example, category_id, owner_id, is_public, ipa"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-8">
        <Link
          href="/learn"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Learn
        </Link>

        <header>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <span>{YOUR_WORDS.emoji}</span>
            {YOUR_WORDS.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your own phrases. They show up in flashcards, quizzes and your
            progress — just like community words.
          </p>
        </header>

        <MyWordsClient
          userId={user.id}
          initial={(words ?? []) as Phrase[]}
        />
      </div>
    </div>
  )
}
