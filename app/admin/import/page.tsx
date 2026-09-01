import { createClient } from "@/lib/supabase/server"
import { ImportWordsForm } from "@/components/admin/ImportWordsForm"
import type { Category } from "@/lib/types"

export default async function ImportWordsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Bulk import targets exactly one category — offer system categories plus
  // any categories this admin owns (e.g. ones they created themselves).
  const [{ data: systemCats }, { data: myCats }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, emoji, sort_order, owner_id")
      .is("owner_id", null)
      .order("sort_order"),
    user
      ? supabase
          .from("categories")
          .select("id, name, slug, emoji, sort_order, owner_id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const categories = [...(systemCats ?? []), ...(myCats ?? [])] as Category[]

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Import Words</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV or Excel file to bulk-add phrases into a system category.
        </p>
      </header>

      <ImportWordsForm categories={categories} />
    </div>
  )
}
