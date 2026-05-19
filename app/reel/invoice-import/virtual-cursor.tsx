"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!cursor) return;
    function place() {
      const frame = frameRef.current;
      if (!frame || !cursor) return;
      const frameRect = frame.getBoundingClientRect();

      if ("selector" in cursor) {
        const el = frame.querySelector<HTMLElement>(cursor.selector);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const offsetX = cursor.offsetX ?? r.width / 2;
        const offsetY = cursor.offsetY ?? r.height / 2;
        setPos({
          x: r.left - frameRect.left + offsetX,
          y: r.top - frameRect.top + offsetY,
        });
      } else {
        setPos({ x: cursor.x, y: cursor.y });
      }
    }
    // Defer the first placement past the current render commit so we don't
    // chain a setState inside the effect body.
    const initial = window.setTimeout(place, 0);
    const ro = new ResizeObserver(place);
    if (frameRef.current) ro.observe(frameRef.current);
    window.addEventListener("resize", place);
    const interval = window.setInterval(place, 120);
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
        clickFlash ? "duration-100" : "duration-700",
      )}
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-2px, -2px)",
      }}
    >
      <CursorSprite pressed={clickFlash} />
      {clickFlash && (
        <span className="pointer-events-none absolute -left-3 -top-3 size-8 animate-ping rounded-full bg-forest-mid/40" />
      )}
    </div>
  );
}

function CursorSprite({ pressed }: { pressed: boolean }) {
  return (
    <svg
      width="22"
      height="24"
      viewBox="0 0 22 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-transform",
        pressed ? "scale-90" : "scale-100",
      )}
    >
      <path
        d="M2 1.7L20 12.4L11.6 14L9.2 22L2 1.7Z"
        fill="white"
        stroke="#1A1A14"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
