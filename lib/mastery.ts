import {
  Sparkle,
  Compass,
  Sword,
  Medal,
  Trophy,
  Gem,
  ScrollText,
  Castle,
  Crown,
  Flame,
  type LucideIcon,
} from "lucide-react"

export interface MasteryLevelDef {
  level: number
  title: string
  threshold: number // phrases learned to REACH this level
  icon: LucideIcon
  color: string // tailwind text/border color token
  glow: string // tailwind bg color for the badge glow, at low opacity
}

// Word Mastery Level ladder — based on TOTAL phrases marked "learned"
// across the whole account (all categories + Your Words combined).
export const MASTERY_LEVELS: MasteryLevelDef[] = [
  { level: 1, title: "Awakened of Phrase", threshold: 0, icon: Sparkle, color: "text-slate-400", glow: "bg-slate-400/15" },
  { level: 2, title: "Seeker of Phrase", threshold: 100, icon: Compass, color: "text-emerald-400", glow: "bg-emerald-400/15" },
  { level: 3, title: "Adept of Phrase", threshold: 300, icon: Sword, color: "text-teal-400", glow: "bg-teal-400/15" },
  { level: 4, title: "Champion of Phrase", threshold: 600, icon: Medal, color: "text-sky-400", glow: "bg-sky-400/15" },
  { level: 5, title: "Master of Phrase", threshold: 1000, icon: Trophy, color: "text-indigo-400", glow: "bg-indigo-400/15" },
  { level: 6, title: "Grandmaster of Phrase", threshold: 1500, icon: Gem, color: "text-purple-400", glow: "bg-purple-400/15" },
  { level: 7, title: "Sage of Phrase", threshold: 2200, icon: ScrollText, color: "text-fuchsia-400", glow: "bg-fuchsia-400/15" },
  { level: 8, title: "Lord of Phrase", threshold: 3200, icon: Castle, color: "text-rose-400", glow: "bg-rose-400/15" },
  { level: 9, title: "King of Phrase", threshold: 4500, icon: Crown, color: "text-amber-400", glow: "bg-amber-400/15" },
  { level: 10, title: "God of Phrase", threshold: 5000, icon: Flame, color: "text-yellow-300", glow: "bg-yellow-300/20" },
]

export interface MasteryProgress {
  current: MasteryLevelDef
  next: MasteryLevelDef | null // null once at the max level
  learnedCount: number
  intoLevel: number // phrases earned since reaching `current`
  levelSpan: number // phrases needed from `current` to `next` (0 if maxed)
  pct: number // 0-100 progress toward `next`
}

export function getMasteryProgress(learnedCount: number): MasteryProgress {
  let current = MASTERY_LEVELS[0];
  for (const lvl of MASTERY_LEVELS) {
    if (learnedCount >= lvl.threshold) current = lvl
    else break
  }
  const next =
    MASTERY_LEVELS.find((l) => l.threshold > current.threshold) ?? null

  const intoLevel = learnedCount - current.threshold
  const levelSpan = next ? next.threshold - current.threshold : 0
  const pct = next ? Math.min(100, Math.round((intoLevel / levelSpan) * 100)) : 100

  return { current, next, learnedCount, intoLevel, levelSpan, pct }
}
