"use client"

import { useEffect, useId, useRef, useState } from "react"
import Script from "next/script"
import { cn } from "@/lib/utils"

interface YouGlishWidgetProps {
  phrase: string
  className?: string
}

declare global {
  interface Window {
    // YouGlish sets this flag once the widget script has bootstrapped
    YG?: { Embeds?: { refresh?: () => void } }
  }
}

export function YouGlishWidget({ phrase, className }: YouGlishWidgetProps) {
  const uid = useId().replace(/:/g, "")
  const containerId = `yg-widget-${uid}`
  const [loaded, setLoaded] = useState(false)
  const scriptMountedRef = useRef(false)

  // If the YouGlish script already ran (e.g. navigating between phrase pages),
  // call its refresh so it picks up the new widget div.
  useEffect(() => {
    if (scriptMountedRef.current) {
      window.YG?.Embeds?.refresh?.()
    }
  }, [phrase])

  function handleScriptLoad() {
    scriptMountedRef.current = true
    // Small delay lets the widget render before we hide the skeleton
    setTimeout(() => setLoaded(true), 800)
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* Skeleton shown until widget bootstraps */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e]" />
            <p className="text-xs text-muted-foreground">Loading pronunciation…</p>
          </div>
        </div>
      )}

      {/* YouGlish embed target */}
      <div
        id={containerId}
        className="youglish-widget w-full"
        data-query={phrase}
        data-lang="english"
        data-components="8172"
        data-bkg-color="theme_dark"
        style={{ minHeight: loaded ? undefined : "300px" }}
      />

      <Script
        src="https://youglish.com/public/embd/widget.js"
        strategy="lazyOnload"
        onLoad={handleScriptLoad}
      />
    </div>
  )
}
