"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Design tokens ──────────────────────────────────────────────────────────

const T = {
  bg: "#fafaf9",
  surface: "#ffffff",
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  accent: "oklch(0.35 0.08 240)",
  radius: "10px",
  radiusSm: "6px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TwoLineCell {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}

function isTwoLine(v: unknown): v is TwoLineCell {
  return typeof v === "object" && v !== null && "primary" in v;
}

export interface ListingColumn<TRow> {
  key: string;
  header: string;
  sortKey?: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: TRow) => React.ReactNode | TwoLineCell;
}

export interface ListingRowAction<TRow> {
  label: string;
  href?: (row: TRow) => string;
  onClick?: (row: TRow) => void;
  variant?: "default" | "destructive";
}

export interface ListingKPI {
  label: string;
  value: React.ReactNode;
  sub?: string;
}

export interface SavedView {
  id: string;
  label: string;
  count?: number;
}

export interface StatusSegment {
  value: string;
  label: string;
}

export interface ListingPageProps<TRow> {
  title: string;
  subtitle?: string;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  savedViews?: SavedView[];
  activeView?: string;
  onViewChange?: (id: string) => void;
  kpis?: ListingKPI[];
  searchPlaceholder?: string;
  statusSegments?: StatusSegment[];
  activeSegment?: string;
  onSegmentChange?: (value: string) => void;
  columns: ListingColumn<TRow>[];
  getRowId?: (row: TRow) => string;
  onRowClick?: (row: TRow) => void;
  rowActions?: ListingRowAction<TRow>[];
  rows: TRow[];
  total: number;
  isLoading?: boolean;
  isFetching?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  hidePagination?: boolean;
  // Pagination
  page: number;
  pageSize: number;
  pageCount: number;
  searchInput: string;
  sort?: string;
  direction?: "asc" | "desc";
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSearchChange: (value: string) => void;
  onSortChange?: (key: string, dir: "asc" | "desc") => void;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown style={{ width: 12, height: 12, opacity: 0.4 }} />;
  if (direction === "asc") return <ChevronUp style={{ width: 12, height: 12 }} />;
  return <ChevronDown style={{ width: 12, height: 12 }} />;
}

function LoadingBar() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        background: T.line2,
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      <div
        style={{
          height: "100%",
          width: "40%",
          background: T.accent,
          borderRadius: "2px",
          animation: "listing-slide 1.2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ListingPage<TRow>({
  title,
  subtitle,
  primaryAction,
  secondaryActions,
  savedViews,
  activeView,
  onViewChange,
  kpis,
  searchPlaceholder = "Search…",
  statusSegments,
  activeSegment,
  onSegmentChange,
  columns,
  getRowId,
  onRowClick,
  rowActions,
  rows,
  total,
  isLoading,
  isFetching,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  hidePagination,
  page,
  pageSize,
  pageCount,
  searchInput,
  sort = "",
  direction = "desc",
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onSortChange,
}: ListingPageProps<TRow>) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Inject keyframe animation
  useEffect(() => {
    const id = "listing-page-keyframes";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @keyframes listing-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  function handleSort(col: ListingColumn<TRow>) {
    if (!col.sortKey || !onSortChange) return;
    if (sort === col.sortKey) {
      onSortChange(col.sortKey, direction === "asc" ? "desc" : "asc");
    } else {
      onSortChange(col.sortKey, "desc");
    }
  }

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const isEmpty = !isLoading && rows.length === 0 && !searchInput.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Page header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          paddingBottom: 20,
          marginBottom: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: T.ink,
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: T.muted, marginTop: 3, marginBottom: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
          {secondaryActions}
          {primaryAction}
        </div>
      </div>

      {/* ── Saved views ── */}
      {savedViews && savedViews.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: `1px solid ${T.line}`,
            marginBottom: 0,
          }}
        >
          {savedViews.map(view => {
            const isActive = (activeView ?? savedViews[0]?.id) === view.id;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => onViewChange?.(view.id)}
                style={{
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? T.ink : T.muted,
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${isActive ? T.ink : "transparent"}`,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  marginBottom: -1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "color 0.15s",
                }}
              >
                {view.label}
                {view.count !== undefined && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: "1px 6px",
                      borderRadius: 100,
                      background: isActive ? T.ink : T.line,
                      color: isActive ? T.surface : T.muted,
                    }}
                  >
                    {view.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── KPI strip ── */}
      {kpis && kpis.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${kpis.length}, 1fr)`,
            gap: 1,
            background: T.line,
            border: `1px solid ${T.line}`,
            borderRadius: T.radiusSm,
            overflow: "hidden",
            margin: "16px 0",
          }}
        >
          {kpis.map((kpi, i) => (
            <div
              key={i}
              style={{
                background: T.surface,
                padding: "14px 18px",
              }}
            >
              <div style={{ fontSize: 11, color: T.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: T.ink, fontFamily: T.mono }}>
                {kpi.value}
              </div>
              {kpi.sub && (
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{kpi.sub}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Main card ── */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: T.radius,
          overflow: "hidden",
          marginTop: (savedViews && savedViews.length > 0) || (kpis && kpis.length > 0) ? 16 : 16,
        }}
      >
        {/* ── Toolbar ── */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${T.line2}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: 140, maxWidth: 320 }}>
            <Search
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 14,
                height: 14,
                color: T.muted,
                pointerEvents: "none",
              }}
            />
            <input
              ref={searchRef}
              value={searchInput}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: "100%",
                paddingLeft: 32,
                paddingRight: searchInput ? 28 : 10,
                paddingTop: 7,
                paddingBottom: 7,
                border: `1px solid ${T.line}`,
                borderRadius: T.radiusSm,
                background: T.line2,
                fontSize: 13,
                color: T.ink,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: T.muted,
                  display: "flex",
                }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>

          {/* Status segments */}
          {statusSegments && statusSegments.length > 0 && (
            <div
              style={{
                display: "flex",
                background: T.line2,
                borderRadius: T.radiusSm,
                padding: 2,
                gap: 1,
              }}
            >
              {statusSegments.map(seg => {
                const isActive = (activeSegment ?? statusSegments[0]?.value) === seg.value;
                return (
                  <button
                    key={seg.value}
                    type="button"
                    onClick={() => onSegmentChange?.(seg.value)}
                    style={{
                      padding: "5px 11px",
                      fontSize: 12,
                      fontWeight: isActive ? 500 : 400,
                      color: isActive ? T.ink : T.muted,
                      background: isActive ? T.surface : "transparent",
                      border: isActive ? `1px solid ${T.line}` : "1px solid transparent",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      transition: "all 0.12s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {seg.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Spacer + record count */}
          <div style={{ marginLeft: "auto", fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>
            {isLoading ? "Loading…" : total > 0 ? `${total.toLocaleString()} record${total === 1 ? "" : "s"}` : ""}
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ position: "relative", overflowX: "auto" }}>
          {isFetching && !isLoading && <LoadingBar />}

          {isLoading ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: T.muted, fontSize: 13 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 14,
                      width: `${60 + (i % 3) * 15}%`,
                      background: T.line2,
                      borderRadius: 4,
                      opacity: 1 - i * 0.1,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : isEmpty ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 6 }}>
                {emptyTitle}
              </div>
              {emptyDescription && (
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 16 }}>{emptyDescription}</div>
              )}
              {emptyAction}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                color: T.ink2,
                opacity: isFetching ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      style={{
                        padding: "10px 16px",
                        textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                        fontWeight: 500,
                        fontSize: 12,
                        color: T.muted,
                        borderBottom: `1px solid ${T.line2}`,
                        background: T.line2,
                        whiteSpace: "nowrap",
                        width: col.width,
                        userSelect: "none",
                        cursor: col.sortKey ? "pointer" : "default",
                      }}
                      onClick={() => col.sortKey && handleSort(col)}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {col.header}
                        {col.sortKey && (
                          <SortIcon active={sort === col.sortKey} direction={direction} />
                        )}
                      </span>
                    </th>
                  ))}
                  {rowActions && rowActions.length > 0 && (
                    <th
                      style={{
                        padding: "10px 16px",
                        width: 1,
                        background: T.line2,
                        borderBottom: `1px solid ${T.line2}`,
                      }}
                    />
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + (rowActions ? 1 : 0)}
                      style={{ padding: "32px 24px", textAlign: "center", color: T.muted, fontSize: 13 }}
                    >
                      No results match your search.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const rowId = getRowId ? getRowId(row) : String(idx);
                    const isHovered = hoveredRow === rowId;
                    return (
                      <tr
                        key={rowId}
                        onMouseEnter={() => setHoveredRow(rowId)}
                        onMouseLeave={() => setHoveredRow(null)}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        style={{
                          background: isHovered ? T.line2 : "transparent",
                          cursor: onRowClick ? "pointer" : "default",
                          transition: "background 0.1s",
                          borderBottom: `1px solid ${T.line2}`,
                        }}
                      >
                        {columns.map(col => {
                          const value = col.render(row);
                          return (
                            <td
                              key={col.key}
                              style={{
                                padding: "11px 16px",
                                textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
                                verticalAlign: "middle",
                              }}
                            >
                              {isTwoLine(value) ? (
                                <div>
                                  <div>{value.primary}</div>
                                  {value.secondary !== undefined && (
                                    <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>
                                      {value.secondary}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                value
                              )}
                            </td>
                          );
                        })}
                        {rowActions && rowActions.length > 0 && (
                          <td
                            style={{
                              padding: "11px 16px",
                              whiteSpace: "nowrap",
                              opacity: isHovered ? 1 : 0,
                              transition: "opacity 0.12s",
                            }}
                          >
                            <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                              {rowActions.map((action, aIdx) => {
                                const isDestructive = action.variant === "destructive";
                                const href = action.href?.(row);
                                const btnStyle: React.CSSProperties = {
                                  padding: "4px 10px",
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: isDestructive ? "oklch(0.55 0.22 25)" : T.ink2,
                                  background: T.surface,
                                  border: `1px solid ${T.line}`,
                                  borderRadius: "5px",
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                };
                                if (href) {
                                  return (
                                    <Link
                                      key={aIdx}
                                      href={href}
                                      style={btnStyle}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      {action.label}
                                    </Link>
                                  );
                                }
                                return (
                                  <button
                                    key={aIdx}
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      action.onClick?.(row);
                                    }}
                                    style={btnStyle}
                                  >
                                    {action.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {!hidePagination && !isLoading && !isEmpty && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              borderTop: `1px solid ${T.line2}`,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {/* Per-page */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.muted }}>
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={e => onPageSizeChange(Number(e.target.value))}
                style={{
                  padding: "3px 6px",
                  border: `1px solid ${T.line}`,
                  borderRadius: "5px",
                  background: T.surface,
                  fontSize: 12,
                  color: T.ink2,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {[10, 25, 50, 100].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Count */}
            <div style={{ fontSize: 12, color: T.muted }}>
              {total > 0 ? `${start}–${end} of ${total.toLocaleString()}` : "0 records"}
            </div>

            {/* Page nav */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <NavBtn
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                label="Previous"
                icon={<ChevronLeft style={{ width: 14, height: 14 }} />}
              />
              <span style={{ fontSize: 12, color: T.muted, padding: "0 6px" }}>
                {page} / {pageCount || 1}
              </span>
              <NavBtn
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pageCount}
                label="Next"
                icon={<ChevronRight style={{ width: 14, height: 14 }} />}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NavBtn({
  onClick,
  disabled,
  label,
  icon,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${T.line}`,
        borderRadius: "5px",
        background: disabled ? T.line2 : T.surface,
        color: disabled ? T.muted : T.ink2,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
    </button>
  );
}

// ─── Pill helper ─────────────────────────────────────────────────────────────

export function StatusPill({
  label,
  bg,
  color,
  dot = true,
}: {
  label: string;
  bg: string;
  color: string;
  dot?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 100,
        fontSize: 12,
        fontWeight: 500,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}

// ─── Mono text helper ─────────────────────────────────────────────────────────

export function MonoText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 12 }}>
      {children}
    </span>
  );
}
