"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { fetchPronunciation } from "@/lib/dictionary"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/auth/AuthForm"
import { Plus, X, Wand2 } from "lucide-react"

/**
 * Owner-only "add word to this category" form. Creates a phrase owned by the
 * user, filed under the given category. Refreshes the page to show it.
 */
export function AddWordToCategory({
  categoryId,
  userId,
}: {
  categoryId: string | number
  userId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState("")
  const [definition, setDefinition] = useState("")
  const [example, setExample] = useState("")
  const [ipa, setIpa] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function reset() {
    setPhrase("")
    setDefinition("")
    setExample("")
    setIpa("")
    setError("")
    setOpen(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!phrase.trim() || !definition.trim()) {
      setError("Phrase and definition are required.")
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error: insErr } = await supabase.from("phrases").insert({
      owner_id: userId,
      category_id: categoryId,
      is_public: false,
      phrase: phrase.trim(),
      definition: definition.trim(),
      example: example.trim(),
      ipa: ipa.trim() || null,
    })
    if (insErr) {
      setError(insErr.message)
      setBusy(false)
      return
    }
    reset()
    setBusy(false)
    router.refresh()
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="size-3.5" />
        Add word
      </Button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-3 w-full max-w-4xl space-y-3 rounded-xl border border-primary/30 bg-card p-4"
    >
      <Field label="Phrase" htmlFor="cw-phrase">
        <Input
          id="cw-phrase"
          autoFocus
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder="e.g. Touch base"
        />
      </Field>
      <Field label="Definition" htmlFor="cw-def">
        <Input
          id="cw-def"
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="What does it mean?"
        />
      </Field>
      <Field label="Example (optional)" htmlFor="cw-ex">
        <Input
          id="cw-ex"
          value={example}
          onChange={(e) => setExample(e.target.value)}
          placeholder="A sentence using the phrase"
        />
      </Field>
      <Field label="IPA (optional)" htmlFor="cw-ipa">
        <div className="flex gap-2">
          <Input
            id="cw-ipa"
            value={ipa}
            onChange={(e) => setIpa(e.target.value)}
            placeholder="/ˈbændwɪdθ/"
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!phrase.trim()}
            onClick={async () => {
              const { ipa: fetched } = await fetchPronunciation(phrase)
              if (fetched) setIpa(fetched)
            }}
            className="shrink-0 gap-1"
          >
            <Wand2 className="size-3.5" />
            Auto
          </Button>
        </div>
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Adding…" : "Add word"}
        </Button>
      </div>
    </form>
  )
}
