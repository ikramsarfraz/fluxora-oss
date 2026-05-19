interface DetailPageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

export function DetailPageHeader({
  title,
  description,
  badge,
  children,
}: DetailPageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-[26px] font-medium tracking-[-0.02em] leading-tight text-balance text-ink">{title}</h1>
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
