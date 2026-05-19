import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-border-default bg-card px-2.5 py-1.5 text-sm transition-colors outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink-warm",
        "placeholder:text-muted",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest focus-visible:border-forest",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
        "md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
