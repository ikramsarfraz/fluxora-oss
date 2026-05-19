"use client";

import { cn } from "@/lib/utils";

export function ReelShell({
  children,
  frameRef,
}: {
  children: React.ReactNode;
  frameRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={frameRef}
      className={cn(
        "relative isolate w-full overflow-hidden rounded-xl",
        "border border-border-default bg-page shadow-[0_30px_80px_-30px_rgba(31,58,46,0.35)]",
      )}
      data-reel-frame
    >
      <div className="relative">{children}</div>
    </div>
  );
}
