import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-relaxed whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-info-bg text-info-fg border-info-border",
        success:
          "bg-success-bg text-success-fg border-success-border",
        warning:
          "bg-warning-bg text-warning-fg border-warning-border",
        destructive:
          "bg-danger-bg text-danger-fg border-danger-border",
        outline:
          "border-border-default text-ink-warm bg-transparent",
        muted:
          "bg-surface text-subtle border-border-soft",
        // alias kept for legacy callsites — maps to muted
        secondary:
          "bg-surface text-subtle border-border-soft",
        ghost:
          "bg-transparent text-ink-warm border-transparent hover:bg-surface",
        link:
          "border-transparent bg-transparent text-forest underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
