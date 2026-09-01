import { splitExampleLines } from "@/lib/examples"
import { cn } from "@/lib/utils"

/**
 * Renders an example sentence, splitting bilingual examples (English +
 * Vietnamese translation) onto separate lines instead of running them
 * together — see lib/examples.ts for the formats this handles.
 */
export function ExampleQuote({
  text,
  className,
  lineClassName = "italic leading-relaxed text-foreground",
}: {
  text: string | null | undefined
  className?: string
  lineClassName?: string
}) {
  const lines = splitExampleLines(text)
  if (lines.length === 0) return null

  return (
    <div className={cn("space-y-1", className)}>
      {lines.map((line, i) => (
        <p key={i} className={lineClassName}>
          {i === 0 && "“"}
          {line}
          {i === lines.length - 1 && "”"}
        </p>
      ))}
    </div>
  )
}
