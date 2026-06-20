export type Category = {
  id: string
  name: string
  slug: string
  emoji: string
  sort_order: number
}

export type Phrase = {
  id: string
  phrase: string
  definition: string
  example: string
  category_id: string | null
  owner_id?: string | null
  is_public?: boolean
  ipa?: string | null
}

// Virtual (non-DB) category used to group a user's own phrases everywhere.
export const YOUR_WORDS = {
  slug: "your-words",
  name: "Your Words",
  emoji: "⭐",
} as const

export type UserProgress = {
  id: string
  user_id: string
  phrase_id: string
  status: 'new' | 'learning' | 'learned'
  is_favorite: boolean
  updated_at: string
}

export type PhraseWithProgress = Phrase & {
  progress?: UserProgress
}

// Curated/system examples for a phrase (up to 5).
export type PhraseExample = {
  id: string
  phrase_id: string
  text: string
  sort_order: number
}

// Examples a user adds themselves (up to 5 per phrase).
export type UserExample = {
  id: string
  user_id: string
  phrase_id: string
  text: string
  created_at: string
}

export const MAX_USER_EXAMPLES = 5
