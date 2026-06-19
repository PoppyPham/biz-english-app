"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, X } from "lucide-react"
import { MAX_USER_EXAMPLES, type UserExample } from "@/lib/types"

interface UserExamplesProps {
  phraseId: string
  userId: string | null
  initial: UserExample[]
}

export function UserExamples({ phraseId, userId, initial }: UserExamplesProps) {
  const [examples, setExamples] = useState<UserExample[]>(initial)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const atLimit = examples.length >= MAX_USER_EXAMPLES

  // Guests: invite them to sign in.
  if (!userId) {
    return (
      <p className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3 text-sm text-muted-foreground">
        <Link
          href="/auth/login?message=Login%20to%20add%20your%20own%20examples"
          className="text-[#22c55e] hover:underline underline-offset-2"
        >
          Sign in
        </Link>{" "}
        to add your own examples.
      </p>
    )
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    const trimmed = text.trim()
    if (!trimmed) return
    if (atLimit) {
      setError(`You can add at most ${MAX_USER_EXAMPLES} examples.`)
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data, error: insertError } = await supabase
      .from("user_examples")
      .insert({ user_id: userId, phrase_id: phraseId, text: trimmed })
      .select("id, user_id, phrase_id, text, created_at")
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setExamples((prev) => [...prev, data as UserExample])
    setText("")
    setAdding(false)
    setSaving(false)
  }

  async function handleDelete(exId: string) {
    setDeletingId(exId)
    const prev = examples
    setExamples((list) => list.filter((e) => e.id !== exId)) // optimistic

    const supabase = createClient()
    const { error: delError } = await supabase
      .from("user_examples")
      .delete()
      .eq("id", exId)

    if (delError) {
      setExamples(prev) // rollback
      setError(delError.message)
    }
    setDeletingId(null)
  }

  return (
    <div className="space-y-3">
      {/* User's examples */}
      {examples.map((ex) => (
        <div
          key={ex.id}
          className="group flex items-start justify-between gap-3 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-4"
        >
          <p className="italic leading-relaxed text-foreground">
            &ldquo;{ex.text}&rdquo;
          </p>
          <button
            onClick={() => handleDelete(ex.id)}
            disabled={deletingId === ex.id}
            aria-label="Delete example"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Add form / button */}
      {adding ? (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-[#22c55e]/30 bg-[#1a1a1a] p-3"
        >
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Paste or type an example sentence you found…"
            className="w-full resize-none rounded-lg border border-[#2a2a2a] bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">
              {text.length}/500
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAdding(false)
                  setText("")
                  setError("")
                }}
              >
                <X className="size-3.5" />
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving || !text.trim()}>
                {saving ? "Saving…" : "Add"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          disabled={atLimit}
          className="gap-1.5 border-dashed"
        >
          <Plus className="size-3.5" />
          {atLimit
            ? `Limit reached (${MAX_USER_EXAMPLES}/${MAX_USER_EXAMPLES})`
            : `Add example (${examples.length}/${MAX_USER_EXAMPLES})`}
        </Button>
      )}
    </div>
  )
}
