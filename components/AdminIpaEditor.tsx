"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchPronunciation } from "@/lib/dictionary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShieldCheck, Wand2, Check } from "lucide-react"

/**
 * Admin-only inline IPA editor. Saves directly to phrases.ipa for ANY phrase
 * (including community phrases the admin doesn't own) — allowed by the
 * is_admin() RLS policy. Render this only when the viewer is an admin.
 */
export function AdminIpaEditor({
  phraseId,
  text,
  initialIpa,
}: {
  phraseId: string | number
  text: string
  initialIpa?: string | null
}) {
  const [value, setValue] = useState(initialIpa ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  async function autoFetch() {
    const { ipa } = await fetchPronunciation(text)
    if (ipa) setValue(ipa)
    else setError("Dictionary API has no IPA for this phrase.")
  }

  async function save() {
    setSaving(true)
    setError("")
    setSaved(false)
    const supabase = createClient()
    const { error: updErr } = await supabase
      .from("phrases")
      .update({ ipa: value.trim() || null })
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
        Admin · edit IPA
      </p>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="/ˈbændwɪdθ/"
          className="font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={autoFetch}
          className="shrink-0 gap-1"
        >
          <Wand2 className="size-3.5" />
          Auto
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving} className="shrink-0">
          {saved ? <Check className="size-3.5" /> : saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
