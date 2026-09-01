import * as XLSX from "xlsx"

// Bulk-import row shape, parsed from a CSV/XLSX/XLS file. One row = one phrase.
export interface ImportRow {
  rowNumber: number // 1-based spreadsheet row (header is row 1)
  phrase: string
  definition: string
  example: string
  ipa: string
  errors: string[]
}

const REQUIRED_HEADERS = ["phrase", "definition"] as const
const KNOWN_HEADERS = ["phrase", "definition", "example", "ipa"] as const
const MAX_PHRASE_LENGTH = 200

export interface ParseResult {
  rows: ImportRow[]
  headerErrors: string[]
}

/**
 * Decodes CSV bytes to text. SheetJS's binary CSV reader doesn't reliably
 * detect UTF-8 without a BOM and mangles non-ASCII characters (IPA symbols,
 * accented text) — so we decode explicitly here and hand SheetJS a plain
 * string instead. Falls back to Windows-1252 (Excel's classic CSV export
 * default on Windows) if the bytes aren't valid UTF-8.
 */
function decodeCsvBytes(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder("windows-1252").decode(buffer)
  }
}

/**
 * Parses a CSV, XLS, or XLSX file into import rows. Headers are matched
 * case-insensitively; unknown extra columns are ignored; blank rows skipped.
 */
export async function parsePhrasesFile(file: File): Promise<ParseResult> {
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv"

  let workbook: XLSX.WorkBook
  try {
    if (isCsv) {
      const text = decodeCsvBytes(await file.arrayBuffer())
      workbook = XLSX.read(text, { type: "string" })
    } else {
      // .xlsx / .xls are binary (zip) formats — must stay as raw bytes.
      const buffer = await file.arrayBuffer()
      workbook = XLSX.read(buffer, { type: "array" })
    }
  } catch {
    return {
      rows: [],
      headerErrors: [
        "Couldn't read this file. Make sure it's a valid .csv, .xlsx, or .xls file.",
      ],
    }
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], headerErrors: ["The file has no sheets."] }
  }
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  })

  if (raw.length === 0) {
    return { rows: [], headerErrors: ["The file is empty."] }
  }

  const headerRow = (raw[0] ?? []).map((h) => String(h ?? "").trim().toLowerCase())
  const colIndex: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    if ((KNOWN_HEADERS as readonly string[]).includes(h) && !(h in colIndex)) {
      colIndex[h] = i
    }
  })

  const headerErrors = REQUIRED_HEADERS.filter((h) => !(h in colIndex)).map(
    (h) => `Missing required column "${h}".`
  )
  if (headerErrors.length > 0) {
    return { rows: [], headerErrors }
  }

  const get = (line: unknown[], key: string) => {
    const idx = colIndex[key]
    return idx === undefined ? "" : String(line[idx] ?? "").trim()
  }

  const rows: ImportRow[] = []
  for (let i = 1; i < raw.length; i++) {
    const line = raw[i] ?? []
    if (line.every((c) => String(c ?? "").trim() === "")) continue // blank row

    const phrase = get(line, "phrase")
    const definition = get(line, "definition")
    const example = get(line, "example")
    const ipa = get(line, "ipa")

    const errors: string[] = []
    if (!phrase) errors.push("Phrase is required.")
    if (!definition) errors.push("Definition is required.")
    if (phrase.length > MAX_PHRASE_LENGTH) {
      errors.push(`Phrase is too long (max ${MAX_PHRASE_LENGTH} characters).`)
    }

    rows.push({ rowNumber: i + 1, phrase, definition, example, ipa, errors })
  }

  return { rows, headerErrors: [] }
}
