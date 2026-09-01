import { createClient } from "@/lib/supabase/server"
import { ImportWordsForm } from "@/components/admin/ImportWordsForm"
import type { Category } from "@/lib/types"

export default async function ImportWordsPage() {
  const supabase = await createClient()

  // System categories only — bulk import targets exactly one at a time.
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, slug, emoji, sort_order")
    .is("owner_id", null)
    .order("sort_order")

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Import Words</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV or Excel file to bulk-add phrases into a system category.
        </p>
      </header>

      <ImportWordsForm categories={(categories ?? []) as Category[]} />
    </div>
  )
}
