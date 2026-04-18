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
        <CardTitle className="text-lg">{title}</CardTitle>
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
