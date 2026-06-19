"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { LogOut, ChevronDown, KeyRound } from "lucide-react"

function getInitials(user: User) {
  const name: string =
    user.user_metadata?.display_name ?? user.email ?? "?"
  return name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function ProfileDropdown({ user }: { user: User }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  const displayName: string =
    user.user_metadata?.display_name ?? user.email ?? "Account"
  const initials = getInitials(user)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#1a1a1a] transition-colors"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-[#22c55e] text-[#0f0f0f] text-xs font-semibold">
          {initials}
        </span>
        <span className="max-w-[120px] truncate text-muted-foreground">
          {displayName}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-[#2a2a2a]">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[#2a2a2a] transition-colors"
          >
            <KeyRound className="size-3.5" />
            Change password
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-[#2a2a2a] transition-colors"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
