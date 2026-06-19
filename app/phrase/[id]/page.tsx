import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { YouGlishWidget } from "@/components/YouGlishWidget"
import { PhraseDetailControls } from "@/components/PhraseDetailControls"
import { UserExamples } from "@/components/UserExamples"
import { ArrowLeft, ArrowRight, Volume2, BookOpen, Quote } from "lucide-react"
import {
  YOUR_WORDS,
  type Category,
  type Phrase,
  type UserProgress,
  type PhraseExample,
  type UserExample,
} from "@/lib/types"

export default async function PhrasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch the phrase
  const { data: phrase } = await supabase
    .from("phrases")
    .select("id, phrase, definition, example, category_id, owner_id, is_public")
    .eq("id", id)
    .single()

  if (!phrase) notFound()

  const p = phrase as Phrase
  const isUserWord = p.category_id == null && p.owner_id != null
  const isOwner = !!user && p.owner_id === user.id

  // Fetch category + siblings + progress + examples in parallel.
  // Siblings: by category for community phrases, by owner for user words.
  const siblingsQuery = isUserWord
    ? supabase.from("phrases").select("id").eq("owner_id", p.owner_id!).order("phrase")
    : supabase.from("phrases").select("id").eq("category_id", p.category_id).order("phrase")

  const [
    { data: category },
    { data: siblings },
    { data: progressRow },
    { data: systemExamples },
    { data: userExamples },
  ] = await Promise.all([
    p.category_id != null
      ? supabase
          .from("categories")
          .select("id, name, slug, emoji")
          .eq("id", p.category_id)
          .single()
      : Promise.resolve({ data: null }),
    siblingsQuery,
    user
      ? supabase
          .from("user_progress")
          .select("id, user_id, phrase_id, status, is_favorite, updated_at")
          .eq("user_id", user.id)
          .eq("phrase_id", id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("phrase_examples")
      .select("id, phrase_id, text, sort_order")
      .eq("phrase_id", id)
      .order("sort_order"),
    user
      ? supabase
          .from("user_examples")
          .select("id, user_id, phrase_id, text, created_at")
          .eq("user_id", user.id)
          .eq("phrase_id", id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ])

  // Compute prev / next
  const siblingIds = (siblings ?? []).map((s: { id: string }) => s.id)
  const currentIdx = siblingIds.indexOf(id)
  const prevId = currentIdx > 0 ? siblingIds[currentIdx - 1] : null
  const nextId =
    currentIdx < siblingIds.length - 1 ? siblingIds[currentIdx + 1] : null

  const progress = progressRow as UserProgress | null
  const cat = category as Category | null

  // Where "back" goes + the label shown.
  const backHref = isUserWord ? "/words" : cat ? `/learn/${cat.slug}` : "/"
  const backLabel = isUserWord
    ? `${YOUR_WORDS.emoji} ${YOUR_WORDS.name}`
    : cat
    ? `${cat.emoji} ${cat.name}`
    : null
  const showCounter = isUserWord || !!cat

  // Curated examples = the phrase's built-in example (if any) + phrase_examples rows.
  const curatedExamples: string[] = [
    ...((phrase as Phrase).example ? [(phrase as Phrase).example] : []),
    ...((systemExamples ?? []) as PhraseExample[]).map((e) => e.text),
  ]
  const initialUserExamples = (userExamples ?? []) as UserExample[]

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Sticky top bar */}
      <div className="sticky top-0 md:top-14 z-30 border-b border-[#2a2a2a] bg-[#0f0f0f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 md:px-8">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
            {backLabel ? (
              <span className="hidden sm:inline">{backLabel}</span>
            ) : (
              <span>Back</span>
            )}
          </Link>

          {showCounter && siblingIds.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {currentIdx + 1} / {siblingIds.length}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8 md:py-12">
        {/* ── Phrase heading ── */}
        <div>
          {isOwner && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5 text-[11px] font-medium text-[#22c55e]">
                {YOUR_WORDS.emoji} {p.is_public ? "Your word · Public" : "Your word"}
              </span>
              <Link
                href="/words"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Edit
              </Link>
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {(phrase as Phrase).phrase}
          </h1>
        </div>

        {/* ── Definition ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="size-4 text-[#22c55e]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Definition
            </h2>
          </div>
          <div className="rounded-xl border-l-2 border-[#22c55e] bg-[#1a1a1a] px-5 py-4">
            <p className="leading-relaxed text-foreground">
              {(phrase as Phrase).definition}
            </p>
          </div>
        </section>

        {/* ── Examples ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Quote className="size-4 text-[#22c55e]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Examples
            </h2>
          </div>

          <div className="space-y-3">
            {/* Curated / system examples */}
            {curatedExamples.map((text, i) => (
              <div
                key={`sys-${i}`}
                className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-5 py-4"
              >
                <p className="italic leading-relaxed text-foreground">
                  &ldquo;{text}&rdquo;
                </p>
              </div>
            ))}

            {curatedExamples.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No examples yet — add your own below.
              </p>
            )}
          </div>

          {/* User-contributed examples */}
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Your examples
            </p>
            <UserExamples
              phraseId={id}
              userId={user?.id ?? null}
              initial={initialUserExamples}
            />
          </div>
        </section>

        {/* ── YouGlish ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Volume2 className="size-4 text-[#22c55e]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hear it spoken
            </h2>
          </div>
          <YouGlishWidget
            phrase={(phrase as Phrase).phrase}
            className="max-h-[300px] overflow-hidden rounded-xl md:max-h-none"
          />
        </section>

        {/* ── Status + favorite ── */}
        {user && (
          <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your progress
            </p>
            <PhraseDetailControls
              phraseId={id}
              userId={user.id}
              initialStatus={progress?.status ?? "new"}
              initialFavorite={progress?.is_favorite ?? false}
            />
          </section>
        )}

        {/* ── Prev / Next navigation ── */}
        <nav className="flex items-center justify-between gap-4 border-t border-[#2a2a2a] pt-6">
          {prevId ? (
            <Link
              href={`/phrase/${prevId}`}
              className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[#3a3a3a] hover:text-foreground"
            >
              <ArrowLeft className="size-4 shrink-0" />
              Previous
            </Link>
          ) : (
            <div />
          )}

          {nextId ? (
            <Link
              href={`/phrase/${nextId}`}
              className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[#3a3a3a] hover:text-foreground"
            >
              Next
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          ) : (
            <Link
              href={backHref}
              className="flex items-center gap-2 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-2.5 text-sm text-[#22c55e] transition-colors hover:bg-[#22c55e]/20"
            >
              Back to {isUserWord ? YOUR_WORDS.name : cat?.name ?? "list"}
              <ArrowRight className="size-4 shrink-0" />
            </Link>
          )}
        </nav>
      </div>
    </div>
  )
}
