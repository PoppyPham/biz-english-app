"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Script from "next/script"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { RacerQuestion } from "@/lib/phraseRacer"

interface PhraseRacerHandle {
  unmount: () => void
}

interface PhraseRacerApi {
  mount: (
    container: HTMLElement,
    opts: {
      questions: RacerQuestion[]
      categoryName: string
      onGameOver: (distanceM: number) => void
    }
  ) => PhraseRacerHandle
}

declare global {
  interface Window {
    PhraseRacer?: PhraseRacerApi
  }
}

export function PhraseRacerGame({
  questions,
  userId,
  categoryName,
  categorySlug,
  backHref,
}: {
  questions: RacerQuestion[]
  userId: string | null
  categoryName: string
  categorySlug: string | null
  backHref: string
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [engineReady, setEngineReady] = useState(false)
  const scope = categorySlug ?? "all"

  useEffect(() => {
    const container = mountRef.current
    if (!engineReady || !container || !window.PhraseRacer) return

    const supabase = createClient()
    let bestSaved = 0
    let cancelled = false

    async function loadBest() {
      if (!userId) return
      const { data } = await supabase
        .from("phrase_racer_high_scores")
        .select("high_score")
        .eq("user_id", userId)
        .eq("scope", scope)
        .maybeSingle()
      if (!cancelled) bestSaved = data?.high_score ?? 0
    }
    loadBest()

    const handle = window.PhraseRacer.mount(container, {
      questions,
      categoryName,
      onGameOver: (distanceM) => {
        if (!userId) return
        const rounded = Math.round(distanceM)
        if (rounded > bestSaved) {
          bestSaved = rounded
          supabase
            .from("phrase_racer_high_scores")
            .upsert({ user_id: userId, scope, high_score: rounded }, { onConflict: "user_id,scope" })
            .then(() => {})
        }
      },
    })

    return () => {
      cancelled = true
      handle.unmount()
    }
  }, [engineReady, questions, userId, scope, categoryName])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <Script
        src="/games/phrase-racer/engine.js"
        strategy="afterInteractive"
        onReady={() => setEngineReady(true)}
      />
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <Link
          href={backHref}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <p className="truncate text-sm font-medium">
          Phrase Racer <span className="text-muted-foreground">· {categoryName}</span>
        </p>
      </div>
      <div ref={mountRef} className="min-h-0 flex-1" />
    </div>
  )
}
