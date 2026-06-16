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
  category_id: string
}

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
