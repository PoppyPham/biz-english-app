import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LeaderboardTabs, type LeaderboardRow } from "@/components/LeaderboardTabs"
import { Trophy } from "lucide-react"

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
            Quiz: ranked by highest score · Flashcard: ranked by phrases learned
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
        <LeaderboardTabs rows={rows} currentUserId={user.id} />
      </div>
    </div>
  )
}
