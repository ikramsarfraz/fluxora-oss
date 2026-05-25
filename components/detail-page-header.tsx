import { cn } from "@/lib/utils";

interface DetailPageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  /**
   * `default` renders the serif title used by every detail page whose
   * title is prose (product name, customer name, category name, …).
   *
   * `identifier` renders a mono / semibold title for pages whose title
   * IS an identifier and reads as a code rather than prose (barcodes,
   * lot numbers, order numbers, invoice numbers). Matches the inline
   * H1 historically hand-rolled on the orders and supplier-invoices
   * detail pages so the whole app speaks one visual language for "this
   * thing is a code you can copy".
   */
  variant?: "default" | "identifier";
}

export function DetailPageHeader({
  title,
  description,
  badge,
  children,
  variant = "default",
}: DetailPageHeaderProps) {
  const isIdentifier = variant === "identifier";

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1
            className={cn(
              "text-[26px] leading-tight text-balance text-ink",
              isIdentifier
                ? "font-mono font-semibold tracking-[-0.025em]"
                : "font-serif font-medium tracking-[-0.02em]",
            )}
          >
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-subtle mt-1">{description}</p>
        )}
      </div>
      {children && (
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
          {children}
        </div>
      )}
    </div>
  );
}
