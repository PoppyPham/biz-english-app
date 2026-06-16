"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, BookOpen, Gamepad2, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: House },
  { href: "/learn", label: "Learn", Icon: BookOpen },
  { href: "/games", label: "Games", Icon: Gamepad2 },
  { href: "/progress", label: "Progress", Icon: BarChart2 },
]

export function BottomNav() {
  const pathname = usePathname()

  if (pathname.startsWith("/auth")) return null

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#2a2a2a] bg-[#0f0f0f] pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 pt-3 pb-2 text-xs transition-colors",
                active
                  ? "text-[#22c55e]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-[#22c55e]" />
              )}
              <Icon className="size-5" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
