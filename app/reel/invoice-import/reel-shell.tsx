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
        "relative isolate h-screen w-screen overflow-hidden bg-page",
      )}
      data-reel-frame
    >
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
