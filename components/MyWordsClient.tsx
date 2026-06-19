"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/auth/AuthForm"
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Globe,
  Lock,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Phrase } from "@/lib/types"

type Draft = { phrase: string; definition: string; example: string }
const EMPTY: Draft = { phrase: "", definition: "", example: "" }

interface MyWordsClientProps {
  userId: string
  initial: Phrase[]
}

export function MyWordsClient({ userId, initial }: MyWordsClientProps) {
  const [words, setWords] = useState<Phrase[]>(initial)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  function resetForm() {
    setDraft(EMPTY)
    setError("")
    setCreating(false)
    setEditingId(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!draft.phrase.trim() || !draft.definition.trim()) {
      setError("Phrase and definition are required.")
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { data, error: insErr } = await supabase
      .from("phrases")
      .insert({
        owner_id: userId,
        category_id: null,
        is_public: false,
        phrase: draft.phrase.trim(),
        definition: draft.definition.trim(),
        example: draft.example.trim(),
      })
      .select("id, phrase, definition, example, category_id, owner_id, is_public")
      .single()

    if (insErr) {
      setError(insErr.message)
      setBusy(false)
      return
    }
    setWords((prev) => [data as Phrase, ...prev])
    resetForm()
    setBusy(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setError("")
    if (!draft.phrase.trim() || !draft.definition.trim()) {
      setError("Phrase and definition are required.")
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error: updErr } = await supabase
      .from("phrases")
      .update({
        phrase: draft.phrase.trim(),
        definition: draft.definition.trim(),
        example: draft.example.trim(),
      })
      .eq("id", editingId)

    if (updErr) {
      setError(updErr.message)
      setBusy(false)
      return
    }
    setWords((prev) =>
      prev.map((w) =>
        w.id === editingId
          ? {
              ...w,
              phrase: draft.phrase.trim(),
              definition: draft.definition.trim(),
              example: draft.example.trim(),
            }
          : w
      )
    )
    resetForm()
    setBusy(false)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this word? This also removes its progress.")) return
    const prev = words
    setWords((list) => list.filter((w) => w.id !== id)) // optimistic
    const supabase = createClient()
    const { error: delErr } = await supabase
      .from("phrases")
      .delete()
      .eq("id", id)
    if (delErr) {
      setWords(prev)
      setError(delErr.message)
    }
  }

  async function togglePublish(word: Phrase) {
    const next = !word.is_public
    setWords((list) =>
      list.map((w) => (w.id === word.id ? { ...w, is_public: next } : w))
    ) // optimistic
    const supabase = createClient()
    const { error: pubErr } = await supabase
      .from("phrases")
      .update({ is_public: next })
      .eq("id", word.id)
    if (pubErr) {
      setWords((list) =>
        list.map((w) =>
          w.id === word.id ? { ...w, is_public: word.is_public } : w
        )
      )
      setError(pubErr.message)
    }
  }

  function startEdit(word: Phrase) {
    setEditingId(word.id)
    setCreating(false)
    setDraft({
      phrase: word.phrase,
      definition: word.definition,
      example: word.example ?? "",
    })
  }

  const DraftForm = ({ onSubmit }: { onSubmit: (e: React.FormEvent) => void }) => (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-xl border border-[#22c55e]/30 bg-[#1a1a1a] p-4"
    >
      <Field label="Phrase" htmlFor="d-phrase">
        <Input
          id="d-phrase"
          autoFocus
          value={draft.phrase}
          onChange={(e) => setDraft((d) => ({ ...d, phrase: e.target.value }))}
          placeholder="e.g. Touch base"
        />
      </Field>
      <Field label="Definition" htmlFor="d-def">
        <Input
          id="d-def"
          value={draft.definition}
          onChange={(e) =>
            setDraft((d) => ({ ...d, definition: e.target.value }))
          }
          placeholder="What does it mean?"
        />
      </Field>
      <Field label="Example (optional)" htmlFor="d-ex">
        <Input
          id="d-ex"
          value={draft.example}
          onChange={(e) => setDraft((d) => ({ ...d, example: e.target.value }))}
          placeholder="A sentence using the phrase"
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : editingId ? "Save changes" : "Add word"}
        </Button>
      </div>
    </form>
  )

  return (
    <div className="space-y-4">
      {/* Add */}
      {creating ? (
        <DraftForm onSubmit={handleCreate} />
      ) : (
        <Button
          onClick={() => {
            resetForm()
            setCreating(true)
          }}
          className="w-full gap-1.5 bg-[#22c55e] text-[#0f0f0f] hover:bg-[#22c55e]/90"
        >
          <Plus className="size-4" />
          Add a word
        </Button>
      )}

      {error && !creating && !editingId && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* List */}
      {words.length === 0 && !creating ? (
        <p className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a] px-4 py-10 text-center text-sm text-muted-foreground">
          No words yet. Add your first phrase above — it&apos;ll appear in your
          games and progress.
        </p>
      ) : (
        <div className="space-y-3">
          {words.map((word) =>
            editingId === word.id ? (
              <DraftForm key={word.id} onSubmit={handleUpdate} />
            ) : (
              <div
                key={word.id}
                className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/phrase/${word.id}`} className="min-w-0 flex-1 group">
                    <p className="font-medium leading-snug group-hover:underline underline-offset-2">
                      {word.phrase}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {word.definition}
                    </p>
                  </Link>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(word)}
                      aria-label="Edit"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(word.id)}
                      aria-label="Delete"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#2a2a2a] pt-3">
                  <button
                    onClick={() => togglePublish(word)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      word.is_public
                        ? "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#22c55e]"
                        : "border-[#2a2a2a] text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {word.is_public ? (
                      <>
                        <Globe className="size-3.5" />
                        Public — in community
                      </>
                    ) : (
                      <>
                        <Lock className="size-3.5" />
                        Private — publish to community
                      </>
                    )}
                  </button>
                  <Link
                    href={`/phrase/${word.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Open
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
