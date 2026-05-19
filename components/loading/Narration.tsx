"use client";

import { Spinner } from "./Spinner";

interface NarrationProps {
  text: string;
  micro?: string;
  tone?: "blue" | "amber";
}

export function Narration({ text, micro, tone = "blue" }: NarrationProps) {
  const caretColor = tone === "amber" ? "#d97706" : "var(--color-forest-mid)";
  const borderColor = tone === "amber" ? "#fde68a" : "rgba(37,99,235,0.15)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: "rgba(255,255,255,0.7)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        fontFamily: "var(--font-geist-mono, 'JetBrains Mono', ui-monospace, monospace)",
        fontSize: 12,
        color: "var(--color-subtle)",
      }}
    >
      <Spinner size="sm" color={tone === "amber" ? "amber" : "blue"} />
      <span
        dangerouslySetInnerHTML={{ __html: text }}
        style={{ flex: 1 }}
      />
      <span
        className="loading-caret"
        style={{
          display: "inline-block",
          width: 2,
          height: 12,
          background: caretColor,
          animation: "loading-caret 1s infinite",
          marginLeft: 1,
          flexShrink: 0,
        }}
      />
      {micro && (
        <span style={{ fontSize: 10.5, color: "var(--color-muted)", flexShrink: 0 }}>
          {micro}
        </span>
      )}
    </div>
  );
}
