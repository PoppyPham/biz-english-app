"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface YouGlishWidgetProps {
  phrase: string
  lang?: string
  className?: string
}

// Minimal typing for the YouGlish JS API we use.
interface YGWidget {
  fetch: (query: string, lang: string, accent?: string) => void
}
declare global {
  interface Window {
    YG?: {
      Widget: new (
        elementId: string,
        opts: {
          width?: number
          components?: number
          events?: Record<string, (e: unknown) => void>
        }
      ) => YGWidget
    }
    onYouglishAPIReady?: () => void
  }
}

const SCRIPT_ID = "youglish-widget-script"
const SCRIPT_SRC = "https://youglish.com/public/emb/widget.js"
// Sum of component IDs: search box (1) + accent (2) + caption (4) + ... → full UI.
const COMPONENTS = 9

export function YouGlishWidget({
  phrase,
  lang = "english",
  className,
}: YouGlishWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<YGWidget | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    function createOrFetch() {
      if (cancelled || !window.YG || !containerRef.current) return

      if (!widgetRef.current) {
        const width = containerRef.current.clientWidth || 640
        widgetRef.current = new window.YG.Widget("yg-widget-target", {
          width,
          components: COMPONENTS,
          events: {
            onFetchDone: () => !cancelled && setLoaded(true),
            onError: () => !cancelled && setFailed(true),
          },
        })
      }
      widgetRef.current.fetch(phrase, lang)
    }

    // API already present (e.g. SPA navigation between phrases) → just fetch.
    if (window.YG) {
      createOrFetch()
      return () => {
        cancelled = true
      }
    }

    // Otherwise wire the global ready callback and inject the script once.
    window.onYouglishAPIReady = createOrFetch

    let tag = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (!tag) {
      tag = document.createElement("script")
      tag.id = SCRIPT_ID
      tag.src = SCRIPT_SRC
      tag.async = true
      tag.onerror = () => !cancelled && setFailed(true)
      document.body.appendChild(tag)
    }

    return () => {
      cancelled = true
    }
  }, [phrase, lang])

  return (
    <div className={cn("relative w-full", className)}>
      {/* Loading / error overlay */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
          {failed ? (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load the pronunciation widget.
              </p>
              <a
                href={`https://youglish.com/pronounce/${encodeURIComponent(
                  phrase
                )}/english`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#22c55e] hover:underline underline-offset-2"
              >
                Open on YouGlish →
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e]" />
              <p className="text-xs text-muted-foreground">
                Loading pronunciation…
              </p>
            </div>
          )}
        </div>
      )}

      {/* YouGlish injects the player into this element */}
      <div
        ref={containerRef}
        id="yg-widget-target"
        className="w-full"
        style={{ minHeight: loaded ? undefined : "300px" }}
      />
    </div>
  )
}
