"use client";

import { Maximize2, PlayCircle } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// Embedded reel — iframes the full-screen autoplay reel into a sized window.
// The reel itself uses h-screen w-screen, so it fills whatever viewport the
// iframe gives it. Default frame is 16:9; pass `aspect` to override.
export function ReelEmbed({
  slug,
  aspect = "video",
  caption,
  className,
  showOpen = true,
}: {
  slug: string;
  aspect?: "video" | "square" | "portrait";
  caption?: string;
  className?: string;
  showOpen?: boolean;
}) {
  const aspectClass =
    aspect === "square"
      ? "aspect-square"
      : aspect === "portrait"
        ? "aspect-[4/5]"
        : "aspect-video";

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border-default bg-surface shadow-[0_30px_80px_-30px_rgba(31,58,46,0.45)]",
          aspectClass,
        )}
      >
        {/* Browser chrome at the top */}
        <div className="flex items-center gap-1.5 border-b border-border-default bg-surface/80 px-3 py-2 backdrop-blur">
          <span className="size-2 rounded-full bg-danger-fg/60" />
          <span className="size-2 rounded-full bg-warning-fg/60" />
          <span className="size-2 rounded-full bg-success-fg/60" />
          <div className="ml-3 flex flex-1 items-center gap-1.5 rounded-md bg-card-warm/80 px-2 py-0.5 font-mono text-[10px] text-subtle">
            <span>pacificwharf.fluxora.app{slug === "stripe-billing" ? "/account/billing" : ""}</span>
          </div>
          {showOpen ? (
            <Link
              href={`/reel/${slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-md bg-card-warm/80 px-1.5 py-0.5 font-mono text-[9.5px] text-subtle hover:text-ink"
            >
              <Maximize2 className="size-2.5" strokeWidth={2.4} />
              fullscreen
            </Link>
          ) : null}
        </div>

        {/* Iframe */}
        <iframe
          src={`/reel/${slug}`}
          className="absolute inset-x-0 bottom-0 top-[34px] h-[calc(100%-34px)] w-full border-0"
          title={`Reel: ${slug}`}
          loading="lazy"
        />
      </div>

      {caption ? (
        <div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">
          <PlayCircle className="size-3" strokeWidth={2} />
          {caption}
        </div>
      ) : null}
    </div>
  );
}
