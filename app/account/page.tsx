import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ChangePasswordForm } from "@/components/ChangePasswordForm"
import { ArrowLeft } from "lucide-react"

export default async function AccountPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?message=Login%20to%20manage%20your%20account")
  }

  const displayName = user.user_metadata?.display_name as string | undefined

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="mx-auto max-w-md space-y-8 px-4 py-8 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>

        <header>
          <h1 className="text-2xl font-bold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayName ? `${displayName} · ` : ""}
            {user.email}
          </p>
        </header>

        <section className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
          <h2 className="mb-1 text-sm font-semibold">Change password</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Enter your current password, then choose a new one.
          </p>
          <ChangePasswordForm email={user.email!} />
        </section>
      </div>
    </div>
  )
}
