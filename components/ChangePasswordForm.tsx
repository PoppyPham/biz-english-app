"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/auth/AuthForm"
import { CheckCircle2 } from "lucide-react"

export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSuccess(false)

    // ── Client-side validation ──
    if (next.length < 6) {
      setError("New password must be at least 6 characters.")
      return
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match.")
      return
    }
    if (next === current) {
      setError("New password must be different from the current one.")
      return
    }

    setLoading(true)
    const supabase = createClient()

    // 1) Verify the current password by re-authenticating.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    })
    if (signInError) {
      setError("Current password is incorrect.")
      setLoading(false)
      return
    }

    // 2) Update to the new password.
    const { error: updateError } = await supabase.auth.updateUser({
      password: next,
    })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setCurrent("")
    setNext("")
    setConfirm("")
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-2.5 text-sm text-[#22c55e]">
          <CheckCircle2 className="size-4 shrink-0" />
          Password updated successfully.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/20">
          {error}
        </div>
      )}

      <Field label="Current password" htmlFor="current">
        <Input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>

      <Field label="New password" htmlFor="next">
        <Input
          id="next"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm">
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  )
}
