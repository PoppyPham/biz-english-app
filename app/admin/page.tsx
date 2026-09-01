import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Upload, ArrowRight, FileText, FolderTree, Volume2 } from "lucide-react"

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [{ count: totalPhrases }, { count: totalCategories }, { count: missingIpa }] =
    await Promise.all([
      supabase.from("phrases").select("id", { count: "exact", head: true }),
      supabase
        .from("categories")
        .select("id", { count: "exact", head: true })
        .is("owner_id", null),
      supabase
        .from("phrases")
        .select("id", { count: "exact", head: true })
        .is("owner_id", null)
        .or("ipa.is.null,ipa.eq."),
    ])

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">{totalPhrases ?? 0}</p>
          <p className="text-xs text-muted-foreground">Total phrases</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">{totalCategories ?? 0}</p>
          <p className="text-xs text-muted-foreground">System categories</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold">{missingIpa ?? 0}</p>
          <p className="text-xs text-muted-foreground">Community phrases missing IPA</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tools
        </h2>
        <Link href="/admin/import" className="group block">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-surface-hover">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Upload className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Import Words</p>
              <p className="text-sm text-muted-foreground">
                Bulk-add phrases from a CSV or Excel file into a system category.
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileText className="size-3.5" />
          Edit an individual phrase's IPA from its detail page
        </span>
        <span className="flex items-center gap-1.5">
          <FolderTree className="size-3.5" />
          Manage categories at /categories
        </span>
        <span className="flex items-center gap-1.5">
          <Volume2 className="size-3.5" />
          Pronunciation auto-caches to the DB on first view
        </span>
      </div>
    </div>
  )
}
