"use client";

import { cn } from "@/lib/utils";

import { useReelDirector } from "./autopilot";

export function Caption() {
  const { caption } = useReelDirector();
  return (
    <div
      aria-live="polite"
      className={cn(
        "mx-auto mt-6 flex h-16 max-w-2xl flex-col items-center justify-center px-4 text-center",
        "transition-opacity duration-300",
        caption ? "opacity-100" : "opacity-0",
      )}
    >
      {caption && (
        <>
          <h2 className="font-serif text-[20px] font-medium tracking-tight text-ink">
            {caption.headline}
          </h2>
          {caption.body && (
            <p className="mt-1 text-sm text-subtle">{caption.body}</p>
          )}
        </>
      )}
    </div>
  );
}
