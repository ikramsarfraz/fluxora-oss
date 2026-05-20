"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Boxes,
  Database,
  FileText,
  Package,
  Receipt,
  ScanLine,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Animated background layers for full-frame transition screens. Adds depth
// without fighting the headline:
//
//   - Layer 1: 3 concentric rings pulsing outward (radar)
//   - Layer 2: 28 drifting dots in the brand palette
//   - Layer 3: 8 product icons slowly orbiting + rotating
//
// All elements are pointer-events-none and pulled to the muted end of the
// brand palette so the eye still lands on the title.

type Tone = "forest" | "success" | "warning";

export function TransitionBackdrop({
  tone = "forest",
  density = "medium",
}: {
  tone?: Tone;
  density?: "low" | "medium" | "high";
}) {
  const palette = TONE_PALETTE[tone];
  const dotCount = density === "high" ? 36 : density === "medium" ? 26 : 16;
  const glyphCount = density === "high" ? 9 : density === "medium" ? 7 : 5;
  const ringCount = density === "low" ? 2 : 3;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <DriftingGrid color={palette.gridDot} />
      <ConcentricRings count={ringCount} color={palette.ring} />
      <DriftingDots count={dotCount} colors={palette.dotColors} />
      <FloatingGlyphs count={glyphCount} color={palette.glyph} />
    </div>
  );
}

const TONE_PALETTE: Record<
  Tone,
  {
    gridDot: string;
    ring: string;
    dotColors: string[];
    glyph: string;
  }
> = {
  forest: {
    gridDot: "color-mix(in oklch, var(--color-forest-mid) 14%, transparent)",
    ring: "color-mix(in oklch, var(--color-forest-mid) 20%, transparent)",
    dotColors: [
      "color-mix(in oklch, var(--color-forest-mid) 30%, transparent)",
      "color-mix(in oklch, var(--color-gold) 30%, transparent)",
      "color-mix(in oklch, var(--color-forest) 18%, transparent)",
    ],
    glyph: "color-mix(in oklch, var(--color-forest-mid) 22%, transparent)",
  },
  success: {
    gridDot: "color-mix(in oklch, var(--color-success-fg) 14%, transparent)",
    ring: "color-mix(in oklch, var(--color-success-fg) 22%, transparent)",
    dotColors: [
      "color-mix(in oklch, var(--color-success-fg) 30%, transparent)",
      "color-mix(in oklch, var(--color-forest-mid) 25%, transparent)",
    ],
    glyph: "color-mix(in oklch, var(--color-success-fg) 25%, transparent)",
  },
  warning: {
    gridDot: "color-mix(in oklch, var(--color-warning-fg) 14%, transparent)",
    ring: "color-mix(in oklch, var(--color-warning-fg) 22%, transparent)",
    dotColors: [
      "color-mix(in oklch, var(--color-warning-fg) 30%, transparent)",
      "color-mix(in oklch, var(--color-forest-mid) 22%, transparent)",
    ],
    glyph: "color-mix(in oklch, var(--color-warning-fg) 25%, transparent)",
  },
};

// ---------- Concentric pulsing rings ----------
function ConcentricRings({ count, color }: { count: number; color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {Array.from({ length: count }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute aspect-square rounded-full border"
          style={{ borderColor: color }}
          initial={{ width: 80, height: 80, opacity: 0 }}
          animate={{
            width: [80, 700, 900],
            height: [80, 700, 900],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            delay: i * 2,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// ---------- Drifting dots ----------
function DriftingDots({
  count,
  colors,
}: {
  count: number;
  colors: string[];
}) {
  // Stable pseudo-random positions seeded by index so SSR + hydration agree.
  const dots = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const seed = (i * 131 + 17) % 997;
        const x = (seed * 13) % 100; // 0–99 %
        const y = (seed * 7) % 100;
        const size = 2 + ((seed * 3) % 5); // 2–6 px
        const colorIdx = seed % colors.length;
        const driftX = -8 + ((seed * 5) % 16); // -8..7 px
        const driftY = -8 + ((seed * 3) % 16);
        const duration = 7 + (seed % 6); // 7..12 s
        const delay = (seed % 50) / 10;
        return { x, y, size, color: colors[colorIdx], driftX, driftY, duration, delay };
      }),
    [count, colors],
  );

  return (
    <div className="absolute inset-0">
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.size,
            height: d.size,
            background: d.color,
          }}
          animate={{
            x: [0, d.driftX, 0],
            y: [0, d.driftY, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: d.duration,
            repeat: Infinity,
            delay: d.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ---------- Floating product glyphs ----------
const GLYPH_ICONS: LucideIcon[] = [
  FileText,
  Boxes,
  Receipt,
  Database,
  Sparkles,
  Package,
  ScanLine,
  TrendingUp,
];

function FloatingGlyphs({ count, color }: { count: number; color: string }) {
  const glyphs = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const seed = (i * 211 + 71) % 1009;
        const x = 5 + ((seed * 17) % 85); // 5–89 %
        const y = 5 + ((seed * 11) % 85);
        const size = 28 + ((seed * 5) % 28); // 28–55 px
        const rotateStart = (seed % 60) - 30;
        const rotateEnd = rotateStart + ((seed % 2 === 0 ? 1 : -1) * (10 + (seed % 12)));
        const driftX = -24 + ((seed * 3) % 48);
        const driftY = -24 + ((seed * 5) % 48);
        const duration = 12 + (seed % 10);
        const delay = (seed % 40) / 10;
        const Icon = GLYPH_ICONS[seed % GLYPH_ICONS.length];
        return { x, y, size, rotateStart, rotateEnd, driftX, driftY, duration, delay, Icon };
      }),
    [count],
  );

  return (
    <div className="absolute inset-0">
      {glyphs.map((g, i) => {
        const Icon = g.Icon;
        return (
          <motion.span
            key={i}
            className="absolute inline-flex"
            style={{
              left: `${g.x}%`,
              top: `${g.y}%`,
              width: g.size,
              height: g.size,
              color,
            }}
            initial={{ rotate: g.rotateStart, opacity: 0 }}
            animate={{
              x: [0, g.driftX, 0],
              y: [0, g.driftY, 0],
              rotate: [g.rotateStart, g.rotateEnd, g.rotateStart],
              opacity: [0.18, 0.42, 0.18],
            }}
            transition={{
              duration: g.duration,
              repeat: Infinity,
              delay: g.delay,
              ease: "easeInOut",
            }}
          >
            <Icon className="size-full" strokeWidth={1.4} />
          </motion.span>
        );
      })}
    </div>
  );
}

// ---------- Drifting dotted grid ----------
// Replacement for the (over-art-deco) spiral trail. A graph-paper dotted
// grid that drifts diagonally on a slow loop. Sits behind everything as
// structural texture — anchors the page like Linear/Notion app surfaces
// without competing with the headline.
//
// Implementation: an oversized div with a `radial-gradient` repeating
// pattern, translated by exactly one grid cell over 14s. The cell-aligned
// translate is what makes the loop seamless — at the end of the cycle, the
// pattern lands exactly where it started.
function DriftingGrid({ color }: { color: string }) {
  const cell = 38; // px, the grid cell spacing
  return (
    <motion.div
      aria-hidden
      className="absolute -inset-12"
      style={{
        backgroundImage: `radial-gradient(circle, ${color} 1.4px, transparent 1.6px)`,
        backgroundSize: `${cell}px ${cell}px`,
      }}
      animate={{ x: [0, cell], y: [0, cell] }}
      transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
    />
  );
}
