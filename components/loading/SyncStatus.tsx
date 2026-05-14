"use client";

type SyncState = "idle" | "syncing" | "stale";

interface SyncStatusProps {
  state: SyncState;
  label: string;
  onRefresh?: () => void;
}

const REFRESH_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={{ width: 14, height: 14 }}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export function SyncStatus({ state, label, onRefresh }: SyncStatusProps) {
  const isStale = state === "stale";
  const isSyncing = state === "syncing";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 12px",
        background: isStale ? "#fffbeb" : isSyncing ? "#eff6ff" : "#fff",
        border: `1px solid ${isStale ? "#fde68a" : isSyncing ? "#bfdbfe" : "#e7e7ea"}`,
        borderRadius: 999,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        fontSize: 12,
        color: isStale ? "#d97706" : isSyncing ? "#2563eb" : "#52525b",
      }}
    >
      <span
        style={{
          color: isStale ? "#d97706" : isSyncing ? "#2563eb" : "#a1a1aa",
          display: "flex",
          alignItems: "center",
          animation: isSyncing ? "loading-spin 1.5s linear infinite" : undefined,
          flexShrink: 0,
        }}
      >
        {REFRESH_ICON}
      </span>
      <span>{label}</span>
      {state === "idle" && onRefresh && (
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
