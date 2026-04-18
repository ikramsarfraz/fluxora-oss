import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DetailPageHeaderProps {
  backHref: string;
  backLabel: string;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

export function DetailPageHeader({
  backHref,
  backLabel,
  title,
  description,
  badge,
  children,
}: DetailPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 text-muted-foreground hover:text-foreground">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children && (
          <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
