"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { useReelDirector } from "./autopilot";

export function VirtualCursor({
  frameRef,
}: {
  frameRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { cursor, clickFlash } = useReelDirector();
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const visible = cursor != null;
  const lastSelectorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cursor) {
      lastSelectorRef.current = null;
      return;
    }

    // Scroll target into view on first sight so it's actually visible when the
    // cursor lands. We only do this once per target change, not on every
    // re-measure, otherwise the page would jitter forever.
    if ("selector" in cursor && cursor.selector !== lastSelectorRef.current) {
      const frame = frameRef.current;
      if (frame) {
        const el = frame.querySelector<HTMLElement>(cursor.selector);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
      }
      lastSelectorRef.current = cursor.selector;
    } else if (!("selector" in cursor)) {
      lastSelectorRef.current = null;
    }

    function place() {
      const frame = frameRef.current;
      if (!frame || !cursor) return;
      const frameRect = frame.getBoundingClientRect();

      if ("selector" in cursor) {
        const el = frame.querySelector<HTMLElement>(cursor.selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        // Default: 28% in from the left edge, 55% down. Lands near the start
        // of the element's content (text/icon) rather than dead-center, which
        // looks weird on wide table rows. Callers can override.
        const offsetX = cursor.offsetX ?? Math.min(r.width * 0.28, 90);
        const offsetY = cursor.offsetY ?? r.height * 0.55;
        setPos({
          x: r.left - frameRect.left + offsetX,
          y: r.top - frameRect.top + offsetY,
        });
      } else {
        setPos({ x: cursor.x, y: cursor.y });
      }
    }
    // First placement waits a beat so the scrollIntoView smooth animation
    // settles before we read the rect.
    const initial = window.setTimeout(place, 280);
    const ro = new ResizeObserver(place);
    if (frameRef.current) ro.observe(frameRef.current);
    window.addEventListener("resize", place);
    const interval = window.setInterval(place, 140);
    return () => {
      window.clearTimeout(initial);
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.clearInterval(interval);
    };
  }, [cursor, frameRef]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-[60] transition-all ease-out",
        visible ? "opacity-100" : "opacity-0",
        clickFlash ? "duration-150" : "duration-700",
      )}
      style={{
        left: pos.x,
        top: pos.y,
      }}
    >
      <CursorSprite pressed={clickFlash} />
      {clickFlash && (
        <span className="pointer-events-none absolute -top-[18px] -left-[18px] size-9 animate-ping rounded-full bg-forest-mid/40" />
      )}
    </div>
  );
}

function CursorSprite({ pressed }: { pressed: boolean }) {
  // The arrow tip is at SVG-local (1.6, 1.6); we shift the SVG so the tip
  // lands exactly at the (left, top) anchor — no fudge factor.
  return (
    <svg
      width="22"
      height="24"
      viewBox="0 0 22 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: `translate(-1.6px, -1.6px) ${pressed ? "scale(0.9)" : "scale(1)"}` }}
      className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-transform"
    >
      <path
        d="M1.6 1.6L20 12.4L11.6 14L9.2 22L1.6 1.6Z"
        fill="white"
        stroke="#1A1A14"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
