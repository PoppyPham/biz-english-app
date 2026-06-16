import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ProfileDropdown } from "@/components/ProfileDropdown"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/learn", label: "Learn" },
  { href: "/games", label: "Games" },
  { href: "/progress", label: "Progress" },
]

export async function TopNav() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="hidden md:flex h-14 items-center border-b border-[#2a2a2a] bg-[#0f0f0f] px-6 gap-8 sticky top-0 z-40">
      <Link
        href="/"
        className="flex items-center gap-2 font-semibold text-base shrink-0"
      >
        <span className="text-[#22c55e]">Biz</span>
        <span className="text-foreground">English</span>
      </Link>

      <nav className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto">
        {user ? (
          <ProfileDropdown user={user} />
        ) : (
          <Link
            href="/auth/login"
            className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
