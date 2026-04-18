import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 px-6 py-16 text-center",
        className
      )}
    >
      {Icon && (
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Icon className="size-7 text-muted-foreground" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
