"use client";

import { useEffect, useState } from "react";

type SyncState = "idle" | "syncing" | "stale";

interface SyncJob {
  label: string;
  current?: number;
  total?: number;
}

interface SyncStatusPillProps {
  /** Initial state; can be driven by external polling */
  initialState?: SyncState;
  lastSyncedAt?: Date;
  activeJob?: SyncJob;
  staleDays?: number;
  onRefresh?: () => void;
}

const REFRESH_SVG = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ width: 14, height: 14 }}
  >
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

function minutesAgo(date: Date): number {
  return Math.round((Date.now() - date.getTime()) / 60000);
}

export function SyncStatusPill({
  initialState = "idle",
  lastSyncedAt,
  activeJob,
  staleDays,
  onRefresh,
}: SyncStatusPillProps) {
  const [syncState, setSyncState] = useState<SyncState>(
    activeJob ? "syncing" : staleDays !== undefined && staleDays >= 2 ? "stale" : initialState,
  );
  const [minutesAgoStr, setMinutesAgoStr] = useState<string>("");

  useEffect(() => {
    if (!lastSyncedAt) return;
    const update = () => {
      const m = minutesAgo(lastSyncedAt);
      setMinutesAgoStr(m < 1 ? "just now" : `${m} minute${m !== 1 ? "s" : ""} ago`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [lastSyncedAt]);

  useEffect(() => {
    if (activeJob) setSyncState("syncing");
    else if (staleDays !== undefined && staleDays >= 2) setSyncState("stale");
    else setSyncState("idle");
  }, [activeJob, staleDays]);

  const isStale = syncState === "stale";
  const isSyncing = syncState === "syncing";

  return (
    <div
      aria-live="polite"
      aria-label={`Sync status: ${syncState}`}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 50,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 12px",
        background: isStale ? "#fffbeb" : isSyncing ? "#eff6ff" : "#fff",
        border: `1px solid ${isStale ? "#fde68a" : isSyncing ? "#bfdbfe" : "#e7e7ea"}`,
        borderRadius: 999,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        fontSize: 12,
        color: isStale ? "#d97706" : isSyncing ? "#2563eb" : "#52525b",
        pointerEvents: "auto",
      }}
    >
      {/* Icon */}
      <span
        style={{
          color: isStale ? "#d97706" : isSyncing ? "#2563eb" : "#a1a1aa",
          display: "flex",
          alignItems: "center",
          animation: isSyncing ? "loading-spin 1.5s linear infinite" : undefined,
          flexShrink: 0,
        }}
      >
        {REFRESH_SVG}
      </span>

      {/* Label */}
      {isSyncing && activeJob ? (
        <span>
          {activeJob.label}
          {activeJob.current !== undefined && activeJob.total !== undefined && (
            <> · {activeJob.current} of {activeJob.total}</>
          )}
        </span>
      ) : isStale && staleDays !== undefined ? (
        <span>
          Scores last updated {staleDays} day{staleDays !== 1 ? "s" : ""} ago ·{" "}
          <button
            onClick={onRefresh}
            style={{
              background: "none",
              border: "none",
              color: "#d97706",
              fontWeight: 600,
              textDecoration: "underline",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "inherit",
              padding: 0,
            }}
          >
            Refresh now
          </button>
        </span>
      ) : (
        <span>Synced · {minutesAgoStr || "just now"}</span>
      )}

      {/* Refresh button in idle state */}
      {syncState === "idle" && onRefresh && (
        <button
          onClick={onRefresh}
          style={{
            padding: "1px 6px",
            fontSize: 11,
            borderRadius: 5,
            border: "1px solid #e7e7ea",
            background: "transparent",
            cursor: "pointer",
            color: "#52525b",
            fontFamily: "inherit",
          }}
        >
          Refresh
        </button>
      )}
    </div>
  );
}
