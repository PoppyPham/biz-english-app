"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Check } from "lucide-react"

/**
 * Admin-only inline editor for a single text column on `phrases` (e.g.
 * definition, example). Saves directly for ANY phrase (including community
 * ones the admin doesn't own) — allowed by the is_admin() RLS policy on
 * phrases_update_own. Render this only when the viewer is an admin.
 */
export function AdminFieldEditor({
  phraseId,
  field,
  label,
  initialValue,
  placeholder,
}: {
  phraseId: string | number
  field: "definition" | "example"
  label: string
  initialValue?: string | null
  placeholder?: string
}) {
  const [value, setValue] = useState(initialValue ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function save() {
    setSaving(true)
    setError("")
    setSaved(false)
    const supabase = createClient()
    const { error: updErr } = await supabase
      .from("phrases")
      .update({ [field]: value.trim() })
      .eq("id", phraseId)
    if (updErr) setError(updErr.message)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
        <ShieldCheck className="size-3.5" />
        Admin · edit {label.toLowerCase()}
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring dark:bg-input/30"
      />
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saved ? <Check className="size-3.5" /> : saving ? "Saving…" : "Save"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}
