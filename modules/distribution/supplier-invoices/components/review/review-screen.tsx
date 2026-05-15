"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FilterSegmented } from "./filter-segmented";
import { HeaderCard } from "./header-card";
import { LineRow } from "./line-row";
import { PdfPane } from "./pdf-pane";
import { ReviewFooterStrip } from "./review-footer-strip";
import { ReviewHeaderStrip } from "./review-header-strip";
import {
  lineNeedsReview,
  type ReviewCounts,
  type ReviewData,
  type ReviewFilter,
} from "./types";

export function ReviewScreen({ data }: { data: ReviewData }) {
  const [zoom, setZoom] = useState(85);
  const [activeLineId, setActiveLineId] = useState<number | null>(data.lines[0]?.id ?? null);
  const [supplier, setSupplier] = useState(data.parsed.supplier.value);
  const [filter, setFilter] = useState<ReviewFilter>("needs");
  const [rememberAliases, setRememberAliases] = useState(true);
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const counts: ReviewCounts = useMemo(() => {
    const matched = data.lines.filter(l => l.match.status === "matched" && !l.match.warning).length;
    const needsReview = data.lines.filter(l => lineNeedsReview(l.match)).length;
    const fees = data.lines.filter(l => l.match.status === "fee").length;
    return { matched, needsReview, fees, total: data.lines.length };
  }, [data.lines]);

  const filteredLines = useMemo(() => {
    if (filter === "all") return data.lines;
    if (filter === "matched")
      return data.lines.filter(l => l.match.status === "matched" && !l.match.warning);
    return data.lines.filter(l => lineNeedsReview(l.match));
  }, [data.lines, filter]);

  useEffect(() => {
    if (activeLineId == null) return;
    lineRefs.current[activeLineId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeLineId]);

  return (
    <main className="-m-4 flex h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col bg-stone-bg">
      <ReviewHeaderStrip fileName={data.fileName} counts={counts} />

      <div className="flex min-h-0 flex-1">
        <PdfPane
          fileName={data.fileName}
          page={data.page}
          pages={data.pages}
          zoom={zoom}
          onZoom={setZoom}
          lines={data.lines}
          activeLineId={activeLineId}
          onLineClick={setActiveLineId}
        />

        <div
          className="flex min-h-0 flex-col bg-stone-bg"
          style={{ width: "52%", minWidth: 600 }}
        >
          <HeaderCard
            parsed={data.parsed}
            supplierValue={supplier}
            onSupplierChange={setSupplier}
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3.5 border-b border-stone-line bg-stone-surface px-[22px] py-3">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[15px] font-semibold text-stone-ink">Line items</h2>
                <span className="rounded bg-stone-line2 px-1.5 py-0.5 font-mono text-[11px] text-stone-muted">
                  {data.lines.length}
                </span>
              </div>
              <FilterSegmented filter={filter} counts={counts} onChange={setFilter} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-stone-bg">
              {filteredLines.length === 0 ? (
                <div className="px-[22px] py-12 text-center text-[13px] text-stone-muted">
                  No lines match this filter.
                </div>
              ) : (
                filteredLines.map(line => (
                  <div
                    key={line.id}
                    ref={el => {
                      lineRefs.current[line.id] = el;
                    }}
                  >
                    <LineRow
                      line={line}
                      isActive={activeLineId === line.id}
                      onClick={() => setActiveLineId(line.id)}
                    />
                  </div>
                ))
              )}
            </div>

            <ReviewFooterStrip
              rememberAliases={rememberAliases}
              onRememberAliasesChange={setRememberAliases}
              billTotal={data.parsed.total.value}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
