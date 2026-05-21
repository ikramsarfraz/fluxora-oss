import type { ReactNode } from "react";

// ── Types ─────────────────────────────────────────────────────────────────

export type EmptyStateVariant = "warm" | "cool" | "neutral";

export type EmptyStateCta = {
  label: string;
  kind: "primary" | "secondary";
  handler: () => void;
};

export type UnlockCondition = {
  current: number;
  needed: number;
  label: string;
};

export type EmptyStateProps = {
  variant?: EmptyStateVariant;
  icon?: ReactNode;
  title: string;
  body: string;
  unlockCondition?: UnlockCondition;
  ctas?: EmptyStateCta[];
  className?: string;
};

// ── Design tokens ─────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  EmptyStateVariant,
  { bg: string; border: string; iconBg: string }
> = {
  warm: {
    bg: "var(--color-warning-bg)",
    border: "var(--color-warning-border)",
    iconBg:
      "color-mix(in oklch, var(--color-warning-bg) 80%, var(--color-warning-fg))",
  },
  cool: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    iconBg: "#dbeafe",
  },
  neutral: {
    bg: "var(--color-page)",
    border: "var(--color-border-default)",
    iconBg: "var(--color-divider)",
  },
};

// ── Progress bar (unlock condition) ──────────────────────────────────────

function UnlockProgress({ condition }: { condition: UnlockCondition }) {
  const pct = Math.min(100, (condition.current / condition.needed) * 100);

  return (
    <div
      style={{
        marginTop: 16,
        padding: "12px 14px",
        background: "var(--color-divider)",
        borderRadius: 8,
        fontSize: 12.5,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          color: "var(--color-subtle)",
        }}
      >
        <span>{condition.label}</span>
        <span style={{ fontFamily: "ui-monospace,monospace", fontWeight: 600 }}>
          {condition.current}/{condition.needed}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--color-border-default)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 100 ? "var(--color-success-fg)" : "var(--color-forest-mid)",
            borderRadius: 3,
            transition: "width .3s",
          }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function EmptyState({
  variant = "neutral",
  icon,
  title,
  body,
  unlockCondition,
  ctas = [],
  className,
}: EmptyStateProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "40px 32px",
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        borderRadius: 14,
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      {icon && (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: styles.iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            fontSize: 26,
          }}
        >
          {icon}
        </div>
      )}

      <h3
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: "var(--color-ink)",
          margin: "0 0 8px",
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 14,
          color: "var(--color-subtle)",
          margin: 0,
          lineHeight: 1.55,
          maxWidth: 360,
        }}
      >
        {body}
      </p>

      {unlockCondition && <UnlockProgress condition={unlockCondition} />}

      {ctas.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 20,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {ctas.map(cta => (
            <button
              key={cta.label}
              onClick={cta.handler}
              style={{
                padding: cta.kind === "primary" ? "8px 16px" : "7px 14px",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border: cta.kind === "primary" ? "1px solid #18181b" : "1px solid var(--color-border-default)",
                background: cta.kind === "primary" ? "var(--color-ink)" : "var(--color-card)",
                color: cta.kind === "primary" ? "var(--color-card)" : "var(--color-subtle)",
                fontFamily: "inherit",
              }}
            >
              {cta.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
