"use client"

import { cn } from "@/lib/utils"

interface AuthFormProps {
  title: string
  subtitle: string
  error?: string
  info?: string
  children: React.ReactNode
  className?: string
}

export function AuthForm({ title, subtitle, error, info, children, className }: AuthFormProps) {
  return (
    <div className={cn("w-full max-w-sm space-y-6", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {info && !error && (
        <div className="rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/10 px-3 py-2.5 text-sm text-[#22c55e]">
          {info}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/20">
          {error}
        </div>
      )}

      {children}
    </div>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  children: React.ReactNode
}

export function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
