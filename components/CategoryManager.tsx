"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/auth/AuthForm"
import { cn } from "@/lib/utils"
import { FREE_CATEGORY_LIMIT, type Category } from "@/lib/types"
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Globe,
  Lock,
  Sparkles,
  ArrowRight,
} from "lucide-react"

interface CategoryManagerProps {
  userId: string
  isAdmin: boolean
  initial: Category[]
  counts: Record<string, number>
}

export function CategoryManager({
  userId,
  isAdmin,
  initial,
  counts,
}: CategoryManagerProps) {
  const [cats, setCats] = useState<Category[]>(initial)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("📚")
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [limitReached, setLimitReached] = useState(false)

  const atLimit = !isAdmin && cats.length >= FREE_CATEGORY_LIMIT

  function reset() {
    setName("")
    setEmoji("📚")
    setIsPublic(false)
    setError("")
    setCreating(false)
    setEditingId(null)
  }

  function openCreate() {
    if (atLimit) {
      setLimitReached(true)
      return
    }
    reset()
    setLimitReached(false)
    setCreating(true)
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setCreating(false)
    setName(cat.name)
    setEmoji(cat.emoji || "📚")
    setIsPublic(!!cat.is_public)
    setError("")
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { data, error: insErr } = await supabase
      .from("categories")
      .insert({
        owner_id: userId,
        name: name.trim(),
        emoji: emoji.trim() || "📚",
        is_public: isPublic,
        slug: "", // trigger generates a unique slug
        sort_order: 1000,
      })
      .select("id, name, slug, emoji, sort_order, owner_id, is_public")
      .single()

    if (insErr) {
      if (insErr.message.includes("FREE_CATEGORY_LIMIT")) {
        setLimitReached(true)
        setCreating(false)
      } else {
        setError(insErr.message)
      }
      setBusy(false)
      return
    }
    setCats((prev) => [...prev, data as Category])
    reset()
    setBusy(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setError("")
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    setBusy(true)
    const supabase = createClient()
    const { error: updErr } = await supabase
      .from("categories")
      .update({ name: name.trim(), emoji: emoji.trim() || "📚", is_public: isPublic })
      .eq("id", editingId)

    if (updErr) {
      setError(updErr.message)
      setBusy(false)
      return
    }
    setCats((prev) =>
      prev.map((c) =>
        c.id === editingId
          ? { ...c, name: name.trim(), emoji: emoji.trim() || "📚", is_public: isPublic }
          : c
      )
    )
    reset()
    setBusy(false)
  }

  async function handleDelete(cat: Category) {
    const n = counts[cat.id] ?? 0
    const msg = n
      ? `Delete "${cat.name}"? Its ${n} word(s) will move to Your Words (uncategorized).`
      : `Delete "${cat.name}"?`
    if (!confirm(msg)) return

    const prev = cats
    setCats((list) => list.filter((c) => c.id !== cat.id)) // optimistic
    const supabase = createClient()
    // Move words out of this category first, then delete it.
    await supabase
      .from("phrases")
      .update({ category_id: null })
      .eq("category_id", cat.id)
      .eq("owner_id", userId)
    const { error: delErr } = await supabase
      .from("categories")
      .delete()
      .eq("id", cat.id)
    if (delErr) {
      setCats(prev)
      setError(delErr.message)
    }
  }

  async function togglePublic(cat: Category) {
    const next = !cat.is_public
    setCats((list) =>
      list.map((c) => (c.id === cat.id ? { ...c, is_public: next } : c))
    )
    const supabase = createClient()
    const { error: e } = await supabase
      .from("categories")
      .update({ is_public: next })
      .eq("id", cat.id)
    if (e) {
      setCats((list) =>
        list.map((c) => (c.id === cat.id ? { ...c, is_public: cat.is_public } : c))
      )
    }
  }

  const editing = editingId !== null
  const showForm = creating || editing

  return (
    <div className="space-y-4">
      {/* Counter / new button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isAdmin ? (
            <>
              {cats.length} categories{" "}
              <span className="text-primary">· Admin (unlimited)</span>
            </>
          ) : (
            <>
              {cats.length}/{FREE_CATEGORY_LIMIT} categories
            </>
          )}
        </p>
        {!showForm && (
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            New category
          </Button>
        )}
      </div>

      {/* Plus upsell */}
      {limitReached && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Sparkles className="size-4" />
            You&apos;ve reached the free limit of {FREE_CATEGORY_LIMIT} categories
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade to <span className="font-medium text-foreground">Plus</span>{" "}
            to create unlimited categories.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled className="gap-1.5">
              Upgrade to Plus
              <ArrowRight className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLimitReached(false)}
            >
              Not now
            </Button>
          </div>
        </div>
      )}

      {/* Create / edit form (inline JSX — not a nested component) */}
      {showForm && (
        <form
          onSubmit={editing ? handleUpdate : handleCreate}
          className="space-y-3 rounded-xl border border-primary/30 bg-card p-4"
        >
          <div className="flex gap-3">
            <div className="w-16 shrink-0">
              <Field label="Icon" htmlFor="cat-emoji">
                <Input
                  id="cat-emoji"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  maxLength={4}
                  className="text-center text-lg"
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Name" htmlFor="cat-name">
                <Input
                  id="cat-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Interview prep"
                />
              </Field>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPublic((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              isPublic
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
            <span className="flex-1 text-left">
              {isPublic ? "Public — shareable" : "Private — only you"}
            </span>
          </button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create category"}
            </Button>
          </div>
        </form>
      )}

      {/* List */}
      {cats.length === 0 && !creating ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No categories yet. Create one to group your words.
        </p>
      ) : (
        <div className="space-y-2">
          {cats.map((cat) =>
            editingId === cat.id ? null : (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <Link
                  href={`/learn/${cat.slug}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 group"
                >
                  <span className="text-xl leading-none">{cat.emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium group-hover:underline underline-offset-2">
                      {cat.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {counts[cat.id] ?? 0} word(s)
                    </p>
                  </div>
                </Link>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => togglePublic(cat)}
                    aria-label={cat.is_public ? "Make private" : "Make public"}
                    className={cn(
                      "rounded-md p-1.5 transition-colors",
                      cat.is_public
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat.is_public ? (
                      <Globe className="size-4" />
                    ) : (
                      <Lock className="size-4" />
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(cat)}
                    aria-label="Edit"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    aria-label="Delete"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
