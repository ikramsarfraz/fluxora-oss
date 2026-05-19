"use client";

import { Lock, RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";

export function ReelShell({
  children,
  url = "fluxora.app/inventory",
  frameRef,
}: {
  children: React.ReactNode;
  url?: string;
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
      <div className="flex items-center gap-2 border-b border-border-soft bg-card-warm/80 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" aria-hidden />
          <span className="size-2.5 rounded-full bg-[#FEBC2E]" aria-hidden />
          <span className="size-2.5 rounded-full bg-[#28C840]" aria-hidden />
        </div>
        <div className="ml-3 flex flex-1 items-center justify-center">
          <div className="flex w-72 max-w-full items-center gap-1.5 rounded-md border border-border-soft bg-card px-2 py-1 text-[11px] text-subtle">
            <Lock className="size-2.5 text-success-fg" />
            <span className="truncate font-mono" data-mono>
              {url}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-subtle">
          <RotateCw className="size-3" aria-hidden />
        </div>
      </div>
      <div className="relative min-h-[640px] bg-page">{children}</div>
    </div>
  );
}
