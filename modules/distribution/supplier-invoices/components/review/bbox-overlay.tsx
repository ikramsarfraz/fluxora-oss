"use client";

import { cn } from "@/lib/utils";

import type { LineBbox } from "./line-bbox";
import type { ParsedLine } from "./types";

export function BboxOverlay({
  bboxes,
  lines,
  activeLineId,
  scale,
  pageNumber = 1,
  onLineClick,
}: {
  bboxes: LineBbox[];
  lines: ParsedLine[];
  activeLineId: number | null;
  /** Render scale (`zoom/100`), used to convert PDF points to screen px. */
  scale: number;
  /** Which PDF page is currently rendered. Bboxes from other pages are skipped. */
  pageNumber?: number;
  onLineClick: (id: number) => void;
}) {
  const matchedById = new Map(lines.map(l => [l.id, l.match.status === "matched"]));

  return (
    <>
      {bboxes
        .filter(b => (b.page ?? 1) === pageNumber)
        .map(b => {
          const active = activeLineId === b.lineId;
          const matched = matchedById.get(b.lineId) ?? false;
          return (
            <button
              key={b.lineId}
              type="button"
              onClick={() => onLineClick(b.lineId)}
              className={cn(
                "pdf-line pointer-events-auto absolute block border-0 bg-transparent p-0",
                active && "active",
                matched && "matched",
              )}
              style={{
                left: b.x * scale,
                top: b.y * scale,
                width: b.width * scale,
                height: b.height * scale,
              }}
              aria-label={`Line ${b.lineId}`}
            />
          );
        })}
    </>
  );
}
