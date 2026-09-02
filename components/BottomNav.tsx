"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, Gamepad2, BarChart2, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", Icon: House },
  { href: "/games", label: "Games", Icon: Gamepad2 },
  { href: "/progress", label: "Progress", Icon: BarChart2 },
  { href: "/leaderboard", label: "Rank", Icon: Trophy },
]

export function BottomNav() {
  const pathname = usePathname()

  if (pathname.startsWith("/auth")) return null

  const activeIndex = NAV_ITEMS.findIndex(({ href }) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)
  )

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="relative flex">
        <span
          className="absolute top-0 h-0.5 rounded-full bg-primary transition-[left] duration-300 ease-out"
          style={{
            left: `calc(${activeIndex} * (100% / ${NAV_ITEMS.length}) + 1rem)`,
            width: `calc(100% / ${NAV_ITEMS.length} - 2rem)`,
            opacity: activeIndex === -1 ? 0 : 1,
          }}
        />
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
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
