import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin"
import { ArrowLeft, ShieldCheck, Upload } from "lucide-react"

const ADMIN_TABS = [
  { href: "/admin", label: "Overview", icon: ShieldCheck },
  { href: "/admin/import", label: "Import Words", icon: Upload },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?message=Login%20required")
  }
  if (!isAdmin(user)) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-4 md:px-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <ShieldCheck className="size-5 text-primary" />
              Management
            </h1>
          </div>

          <nav className="mt-4 flex gap-1">
            {ADMIN_TABS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">{children}</div>
    </div>
  )
}
