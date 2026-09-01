"use client"

import { useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { parsePhrasesFile, type ImportRow } from "@/lib/importPhrases"
import { fetchPronunciation } from "@/lib/dictionary"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/auth/AuthForm"
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

const CHUNK_SIZE = 200

interface ImportWordsFormProps {
  categories: Category[]
}

interface ImportResult {
  inserted: number
  skippedDuplicates: number
  failed: number
  errors: string[]
}

function normalize(text: string) {
  return text.trim().toLowerCase()
}

export function ImportWordsForm({ categories }: ImportWordsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [categoryId, setCategoryId] = useState("")
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [headerErrors, setHeaderErrors] = useState<string[]>([])
  const [existingPhrases, setExistingPhrases] = useState<Set<string>>(
    new Set()
  )
  const [checkingExisting, setCheckingExisting] = useState(false)

  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [autoFillIpa, setAutoFillIpa] = useState(false)

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  )
  const [result, setResult] = useState<ImportResult | null>(null)

  // ── Derived preview ──
  const preview = useMemo(() => {
    if (!rows) return null

    const valid = rows.filter((r) => r.errors.length === 0)
    const invalid = rows.filter((r) => r.errors.length > 0)

    const seen = new Set<string>()
    const toImport: ImportRow[] = []
    let duplicateCount = 0

    for (const row of valid) {
      const key = normalize(row.phrase)
      const isDup =
        seen.has(key) || (skipDuplicates && existingPhrases.has(key))
      seen.add(key)
      if (isDup) {
        duplicateCount++
      } else {
        toImport.push(row)
      }
    }

    return { valid, invalid, toImport, duplicateCount }
  }, [rows, existingPhrases, skipDuplicates])

  async function loadExistingPhrases(catId: string) {
    if (!catId) {
      setExistingPhrases(new Set())
      return
    }
    setCheckingExisting(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("phrases")
      .select("phrase")
      .eq("category_id", Number(catId))
    setExistingPhrases(
      new Set(((data ?? []) as { phrase: string }[]).map((p) => normalize(p.phrase)))
    )
    setCheckingExisting(false)
  }

  async function handleCategoryChange(value: string) {
    setCategoryId(value)
    setResult(null)
    await loadExistingPhrases(value)
  }

  async function handleFileSelect(file: File) {
    setFileName(file.name)
    setResult(null)
    setParsing(true)
    const parsed = await parsePhrasesFile(file)
    setRows(parsed.rows)
    setHeaderErrors(parsed.headerErrors)
    setParsing(false)
    if (categoryId) await loadExistingPhrases(categoryId)
  }

  function resetFile() {
    setFileName(null)
    setRows(null)
    setHeaderErrors([])
    setResult(null)
    setProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleImport() {
    if (!preview || preview.toImport.length === 0 || !categoryId) return
    setImporting(true)
    setResult(null)

    // Optionally auto-fill missing IPA before insert. The dictionary helper
    // already caches + queues concurrency, so mapping over all rows is safe.
    let toInsert = preview.toImport
    if (autoFillIpa) {
      toInsert = await Promise.all(
        toInsert.map(async (row) => {
          if (row.ipa) return row
          const { ipa } = await fetchPronunciation(row.phrase)
          return ipa ? { ...row, ipa } : row
        })
      )
    }

    const supabase = createClient()
    let inserted = 0
    let failed = 0
    const errors: string[] = []
    const total = toInsert.length
    setProgress({ done: 0, total })

    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE)
      const { error, count } = await supabase
        .from("phrases")
        .insert(
          chunk.map((r) => ({
            owner_id: null,
            category_id: Number(categoryId),
            is_public: false,
            phrase: r.phrase,
            definition: r.definition,
            example: r.example || "",
            ipa: r.ipa || null,
          })),
          { count: "exact" }
        )

      if (error) {
        failed += chunk.length
        errors.push(error.message)
      } else {
        inserted += count ?? chunk.length
      }
      setProgress({ done: Math.min(i + CHUNK_SIZE, total), total })
    }

    setResult({
      inserted,
      skippedDuplicates: preview.duplicateCount,
      failed,
      errors,
    })
    setImporting(false)
    setProgress(null)
    // Refresh the existing-phrases set so a second file in the same session
    // correctly treats just-imported words as duplicates too.
    await loadExistingPhrases(categoryId)
  }

  const canImport =
    !!categoryId && !!preview && preview.toImport.length > 0 && !importing

  return (
    <div className="space-y-5">
      {/* Step 1 — category */}
      <Field label="Target system category" htmlFor="import-category">
        <select
          id="import-category"
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground focus-visible:outline-none focus-visible:border-ring dark:bg-input/30"
        >
          <option value="">Select a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Step 2 — template + upload */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">1. Get the template</p>
            <p className="text-xs text-muted-foreground">
              Columns: phrase, definition, example (optional), ipa (optional).
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
            <a href="/templates/phrases-import-template.csv" download>
              <Download className="size-3.5" />
              Download CSV
            </a>
          </Button>
        </div>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">2. Upload your file</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileSelect(file)
            }}
          />
          {fileName ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              <FileSpreadsheet className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm">{fileName}</span>
              <button
                onClick={resetFile}
                aria-label="Remove file"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Choose CSV or Excel file
            </Button>
          )}
        </div>
      </div>

      {/* Parsing state */}
      {parsing && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Reading file…
        </p>
      )}

      {/* Header errors — file structurally invalid */}
      {headerErrors.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {headerErrors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {/* Preview */}
      {preview && headerErrors.length === 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows found" value={rows?.length ?? 0} />
            <Stat label="Valid" value={preview.valid.length} accent="text-primary" />
            <Stat
              label="Invalid"
              value={preview.invalid.length}
              accent={preview.invalid.length > 0 ? "text-destructive" : undefined}
            />
            <Stat
              label="Duplicates"
              value={preview.duplicateCount}
              accent={preview.duplicateCount > 0 ? "text-amber-500" : undefined}
            />
          </div>

          {!categoryId && (
            <p className="flex items-center gap-1.5 text-sm text-amber-500">
              <AlertTriangle className="size-3.5" />
              Select a target category above before importing.
            </p>
          )}

          {checkingExisting && (
            <p className="text-xs text-muted-foreground">
              Checking for existing words in this category…
            </p>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Skip phrases already in this category (by exact text match)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoFillIpa}
              onChange={(e) => setAutoFillIpa(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            Auto-fill missing IPA from the free dictionary API (slower for
            large files)
          </label>

          {/* Invalid rows detail */}
          {preview.invalid.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rows that will be skipped ({preview.invalid.length})
              </p>
              <div className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {preview.invalid.slice(0, 50).map((r) => (
                  <p key={r.rowNumber} className="text-muted-foreground">
                    Row {r.rowNumber}
                    {r.phrase && <> — &ldquo;{r.phrase}&rdquo;</>}:{" "}
                    <span className="text-destructive">
                      {r.errors.join(" ")}
                    </span>
                  </p>
                ))}
                {preview.invalid.length > 50 && (
                  <p className="text-muted-foreground">
                    …and {preview.invalid.length - 50} more.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Import action */}
          <div className="flex items-center gap-3">
            <Button onClick={handleImport} disabled={!canImport} className="gap-1.5">
              {importing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {progress
                    ? `Importing ${progress.done}/${progress.total}…`
                    : "Importing…"}
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Import {preview.toImport.length} word
                  {preview.toImport.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
            {fileName && !importing && (
              <Button variant="ghost" size="sm" onClick={resetFile}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={cn(
            "rounded-xl border p-4",
            result.failed > 0
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-primary/40 bg-primary/5"
          )}
        >
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 className="size-4 text-primary" />
            Imported {result.inserted} word{result.inserted !== 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.skippedDuplicates} duplicate
            {result.skippedDuplicates !== 1 ? "s" : ""} skipped
            {result.failed > 0 && <>, {result.failed} failed</>}
          </p>
          {result.errors.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-destructive">
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5"
            onClick={resetFile}
          >
            Import another file
          </Button>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className={cn("text-xl font-bold tabular-nums", accent)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
