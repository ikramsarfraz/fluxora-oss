import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DetailSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function DetailSection({
  title,
  description,
  children,
  footer,
  className,
}: DetailSectionProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader>
        {/*
          Section headers used to inherit CardTitle's default
          `font-serif text-[17px]` (overridden to text-lg). On a page with
          several stacked DetailSection cards (inventory item detail has
          six) those serif 18px headings made the page feel editorial /
          heavy. Sans + one size down + neutral tracking reads more like
          "operational" UI chrome and lets the H1 carry the only serif
          beat on the page.
        */}
        <CardTitle className="font-sans text-base font-medium tracking-normal">
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="flex flex-wrap gap-2 border-t pt-6">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}

interface DetailFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function DetailField({ label, children, className }: DetailFieldProps) {
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}

interface DetailGridProps {
  children: React.ReactNode;
  className?: string;
}

export function DetailGrid({ children, className }: DetailGridProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>
  );
}
