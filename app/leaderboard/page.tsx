import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getMasteryProgress } from "@/lib/mastery"
import { cn } from "@/lib/utils"
import { Trophy, Crown, Medal } from "lucide-react"

interface LeaderboardRow {
  user_id: string
  display_name: string | null
  best_score: number
  learned_count: number
}

async function getLeaderboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?message=Login%20to%20see%20the%20leaderboard")
  }

  const { data } = await supabase.rpc("get_leaderboard")

  return { user, rows: (data ?? []) as LeaderboardRow[] }
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const RANK_STYLE = [
  { icon: Crown, color: "text-yellow-300", glow: "bg-yellow-300/15" },
  { icon: Medal, color: "text-slate-300", glow: "bg-slate-300/15" },
  { icon: Medal, color: "text-amber-600", glow: "bg-amber-600/15" },
]

export default async function LeaderboardPage() {
  const { user, rows } = await getLeaderboard()

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Leaderboard
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Trophy className="size-6 text-yellow-400" />
            Top Learners
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by highest Quiz score across all players
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl space-y-2 px-4 py-6 md:px-8">
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No players yet.
          </p>
        )}

        {rows.map((row, i) => {
          const rank = i + 1
          const rankStyle = RANK_STYLE[i]
          const mastery = getMasteryProgress(row.learned_count)
          const MasteryIcon = mastery.current.icon
          const isMe = row.user_id === user.id
          const name = row.display_name?.trim() || "Anonymous"

          return (
            <div
              key={row.user_id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                isMe
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              {/* Rank */}
              <div className="flex size-9 shrink-0 items-center justify-center">
                {rankStyle ? (
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full",
                      rankStyle.glow
                    )}
                  >
                    <rankStyle.icon className={cn("size-5", rankStyle.color)} />
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-muted-foreground">
                    {rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initials(name)}
              </span>

              {/* Name + mastery level */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name}
                  {isMe && (
                    <span className="ml-1.5 text-xs font-normal text-primary">
                      (you)
                    </span>
                  )}
                </p>
                <p
                  className={cn(
                    "flex items-center gap-1 truncate text-xs",
                    mastery.current.color
                  )}
                >
                  <MasteryIcon className="size-3.5 shrink-0" />
                  {mastery.current.title}
                </p>
              </div>

              {/* Best score */}
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-yellow-400">
                  {row.best_score.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">score</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
