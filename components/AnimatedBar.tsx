"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A progress-bar fill that grows from 0 to `pct` on mount.
 * Needed because the parent page is a Server Component — setting the
 * target width on first paint gives the browser nothing to transition from.
 */
export function AnimatedBar({
  pct,
  className,
}: {
  pct: number
  className?: string
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div
      className={cn("h-full transition-[width] duration-700 ease-out", className)}
      style={{ width: `${width}%` }}
    />
  )
}
