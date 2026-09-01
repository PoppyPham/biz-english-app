import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin"
import { CategoryManager } from "@/components/CategoryManager"
import { ArrowLeft } from "lucide-react"
import type { Category } from "@/lib/types"

export default async function CategoriesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?message=Login%20to%20manage%20categories")
  }

  const [{ data: cats }, { data: phraseRows }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, emoji, sort_order, owner_id, is_public")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.from("phrases").select("id, category_id").eq("owner_id", user.id),
  ])

  const myCats = (cats ?? []) as Category[]
  const counts: Record<string, number> = {}
  for (const p of (phraseRows ?? []) as { id: string; category_id: string | null }[]) {
    if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>

        <header>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            My Categories
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your own categories and organize your words into them.
          </p>
        </header>

        <CategoryManager
          userId={user.id}
          isAdmin={isAdmin(user)}
          initial={myCats}
          counts={counts}
        />
      </div>
    </div>
  )
}
