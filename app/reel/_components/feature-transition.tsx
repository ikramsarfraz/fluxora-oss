"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowLeft, ArrowRight, PlayCircle } from "lucide-react";

import { Logomark } from "@/components/brand/logomark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { GROUP_LABEL, getFeatureBySlug } from "../_data/features";
import type { FeatureAccent } from "../_data/features";

// Funky, choreographed entrance for a single feature trailer card. The
// component runs on the client because every visible chunk gets a motion
// variant — headline curtain-reveal, pill spring-pop, drifting hero icon,
// continuous radial breath, dotted-grid scroll.

type ThemeTokens = {
  radial: string;
  ring: string;
  text: string;
  dot: string;
  pill: string;
  pillIcon: string;
  pillBorder: string;
};

const ACCENT_THEMES: Record<FeatureAccent, ThemeTokens> = {
  forest: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-forest-tint) 65%, transparent) 0%, transparent 70%)",
    ring: "ring-forest-tint/70",
    text: "text-forest-mid",
    dot: "bg-forest-mid",
    pill: "bg-forest-tint",
    pillIcon: "text-forest-mid",
    pillBorder: "border-forest-tint-deep/70",
  },
  success: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-success-bg) 75%, transparent) 0%, transparent 70%)",
    ring: "ring-success-border/80",
    text: "text-success-fg",
    dot: "bg-success-fg",
    pill: "bg-success-bg",
    pillIcon: "text-success-fg",
    pillBorder: "border-success-border/80",
  },
  warning: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-warning-bg) 75%, transparent) 0%, transparent 70%)",
    ring: "ring-warning-border/80",
    text: "text-warning-fg",
    dot: "bg-warning-fg",
    pill: "bg-warning-bg",
    pillIcon: "text-warning-fg",
    pillBorder: "border-warning-border/80",
  },
  info: {
    radial:
      "radial-gradient(ellipse 70% 55% at 50% 40%, color-mix(in oklch, var(--color-info-bg) 70%, transparent) 0%, transparent 70%)",
    ring: "ring-info-border/80",
    text: "text-info-fg",
    dot: "bg-info-fg",
    pill: "bg-info-bg",
    pillIcon: "text-info-fg",
    pillBorder: "border-info-border/80",
  },
};

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

const heroContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.2,
    },
  },
};

const slideUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

const headlineLine: Variants = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.55 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 18 },
  },
};

const pillRow: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.05,
      staggerChildren: 0.08,
    },
  },
};

const ctaRow: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.05 },
  },
};

export function FeatureTransition({
  slug,
  total,
  prevSlug,
  nextSlug,
}: {
  slug: string;
  total: number;
  prevSlug?: string;
  nextSlug?: string;
}) {
  const feature = getFeatureBySlug(slug);
  const reduceMotion = useReducedMotion();

  if (!feature) return null;

  const theme = ACCENT_THEMES[feature.accent];
  const Icon = feature.icon;
  const liveDemo = feature.liveDemoHref;

  // When the user has reduced-motion on, skip the entrance choreography and
  // hand-rolled continuous loops. Variants still render; they just resolve
  // instantly.
  const transitionFor = (base: object) =>
    reduceMotion ? { duration: 0 } : base;

  return (
    <main className="relative min-h-screen overflow-hidden bg-page">
      {/* --- continuously-drifting dotted backdrop --- */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--color-border-default) 80%, transparent) 1px, transparent 0)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 80%)",
        }}
        animate={
          reduceMotion
            ? undefined
            : { backgroundPosition: ["0px 0px", "24px 24px"] }
        }
        transition={transitionFor({
          duration: 24,
          ease: "linear",
          repeat: Infinity,
        })}
      />

      {/* --- breathing accent radial --- */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: theme.radial }}
        initial={{ opacity: 0, scale: 1.25 }}
        animate={{
          opacity: 1,
          scale: reduceMotion ? 1 : [1, 1.05, 1],
        }}
        transition={transitionFor({
          opacity: { duration: 1.1, ease: "easeOut" },
          scale: {
            duration: 7,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "loop",
          },
        })}
      />

      {/* --- top bar: back link + chapter chip --- */}
      <motion.header
        className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-8"
        initial={{ y: -28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={transitionFor({ duration: 0.55, ease: EASE_OUT_EXPO })}
      >
        <Link
          href="/reel"
          className="group inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm/80 px-3 py-1.5 text-[11px] text-ink-warm backdrop-blur transition hover:text-ink"
        >
          <ArrowLeft
            className="size-3.5 transition-transform group-hover:-translate-x-0.5"
            strokeWidth={2}
          />
          <span className="font-mono uppercase tracking-[0.12em]">
            All features
          </span>
        </Link>

        <motion.div
          className={cn(
            "inline-flex items-center gap-2.5 rounded-full border bg-card-warm/85 px-3 py-1.5 backdrop-blur",
            theme.pillBorder,
          )}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={transitionFor({
            type: "spring",
            stiffness: 280,
            damping: 18,
            delay: 0.15,
          })}
        >
          <motion.span
            className={cn(
              "flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-card-warm",
              theme.dot,
            )}
            animate={
              reduceMotion ? undefined : { rotate: [0, -6, 6, 0] }
            }
            transition={transitionFor({
              duration: 1.6,
              delay: 0.5,
              ease: "easeInOut",
            })}
          >
            {feature.index}
          </motion.span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            {GROUP_LABEL[feature.group]} · {feature.index} of {total}
          </span>
        </motion.div>
      </motion.header>

      {/* --- hero (orchestrated stagger) --- */}
      <motion.section
        key={feature.slug}
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pt-14 pb-10 text-center md:pt-20"
        variants={heroContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div
          variants={popIn}
          className="flex items-center gap-2 rounded-full border border-border-default bg-card-warm px-3 py-1.5 shadow-sm"
        >
          <Logomark size={20} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
            Fluxora
          </span>
          <span className="text-subtle">·</span>
          <span className={cn("text-[11px] font-medium", theme.text)}>
            Watch
          </span>
        </motion.div>

        <motion.div
          variants={slideUp}
          className={cn(
            "mt-7 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]",
            theme.text,
          )}
        >
          <motion.span
            className={cn("size-1 rounded-full", theme.dot)}
            animate={reduceMotion ? undefined : { scale: [1, 1.6, 1] }}
            transition={transitionFor({
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            })}
          />
          <span>{feature.eyebrow}</span>
          <motion.span
            className={cn("size-1 rounded-full", theme.dot)}
            animate={reduceMotion ? undefined : { scale: [1, 1.6, 1] }}
            transition={transitionFor({
              duration: 1.8,
              delay: 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            })}
          />
        </motion.div>

        {/* Headline — curtain-reveal one line at a time */}
        <h1 className="mt-6 max-w-[680px] font-serif text-[42px] font-medium leading-[1.05] tracking-tight text-ink md:text-[60px]">
          <motion.span variants={headlineLine} className="block">
            {feature.headline[0]}
          </motion.span>
          <motion.span variants={headlineLine} className="block">
            {feature.headline[1]}
          </motion.span>
          <motion.span
            variants={headlineLine}
            className={cn("block", theme.text)}
          >
            {feature.headline[2]}
          </motion.span>
        </h1>

        <motion.p
          variants={slideUp}
          className="mt-6 max-w-[560px] text-[15px] leading-[1.6] text-subtle md:text-[16px]"
        >
          {feature.body}
        </motion.p>

        {/* Pills */}
        <motion.ul
          variants={pillRow}
          className="mt-9 flex flex-wrap items-center justify-center gap-2.5"
        >
          {feature.highlights.map(({ icon: HighlightIcon, label }) => (
            <motion.li
              key={label}
              variants={popIn}
              whileHover={
                reduceMotion ? undefined : { y: -3, scale: 1.04 }
              }
              transition={transitionFor({
                type: "spring",
                stiffness: 380,
                damping: 22,
              })}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border bg-card-warm px-3 py-1.5 shadow-sm",
                theme.pillBorder,
              )}
            >
              <motion.span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full",
                  theme.pill,
                )}
                whileHover={
                  reduceMotion ? undefined : { rotate: [0, -15, 15, 0] }
                }
                transition={transitionFor({ duration: 0.5 })}
              >
                <HighlightIcon
                  className={cn("size-3", theme.pillIcon)}
                  strokeWidth={2}
                />
              </motion.span>
              <span className="text-[12.5px] font-medium text-ink">
                {label}
              </span>
            </motion.li>
          ))}
        </motion.ul>

        {/* CTAs */}
        <motion.div
          variants={ctaRow}
          className="mt-12 flex flex-col items-center gap-3 sm:flex-row"
        >
          <motion.div
            whileHover={reduceMotion ? undefined : { y: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          >
            <Button size="lg" asChild>
              <Link href="/signup">
                Try Fluxora free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </motion.div>

          {liveDemo ? (
            <motion.div
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            >
              <Button size="lg" variant="outline" asChild>
                <Link href={liveDemo}>
                  <PlayCircle className="size-4" />
                  Watch the live demo
                </Link>
              </Button>
            </motion.div>
          ) : null}
        </motion.div>

        <motion.span
          variants={slideUp}
          className="mt-3 text-[11px] text-subtle"
        >
          No credit card · 14-day trial
        </motion.span>
      </motion.section>

      {/* --- oversized hero icon (anchor) --- */}
      <motion.div
        aria-hidden
        className="pointer-events-none relative z-0 mx-auto -mt-2 flex max-w-3xl justify-center"
        initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
        animate={{ opacity: 0.07, scale: 1, rotate: 0 }}
        transition={transitionFor({
          duration: 1.3,
          delay: 0.5,
          ease: EASE_OUT_EXPO,
        })}
      >
        <motion.div
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -14, 0], rotate: [0, 4, 0] }
          }
          transition={transitionFor({
            duration: 9,
            ease: "easeInOut",
            repeat: Infinity,
          })}
        >
          <Icon
            className={cn("size-40 md:size-56", theme.text)}
            strokeWidth={1}
          />
        </motion.div>
      </motion.div>

      {/* --- prev / next nav --- */}
      <footer className="relative z-10 mx-auto mt-2 mb-12 flex max-w-6xl items-center justify-between gap-3 px-6">
        <FeatureNav
          slug={prevSlug}
          direction="prev"
          fallbackHref="/reel"
          fallbackLabel="All features"
          theme={theme}
          delay={1.1}
          reduceMotion={!!reduceMotion}
        />
        <FeatureNav
          slug={nextSlug}
          direction="next"
          fallbackHref="/reel"
          fallbackLabel="All features"
          theme={theme}
          delay={1.2}
          reduceMotion={!!reduceMotion}
        />
      </footer>
    </main>
  );
}

function FeatureNav({
  slug,
  direction,
  fallbackHref,
  fallbackLabel,
  theme,
  delay,
  reduceMotion,
}: {
  slug?: string;
  direction: "prev" | "next";
  fallbackHref: string;
  fallbackLabel: string;
  theme: ThemeTokens;
  delay: number;
  reduceMotion: boolean;
}) {
  const href = slug ? `/reel/${slug}` : fallbackHref;
  const label = slug ? slug.replace(/-/g, " ") : fallbackLabel;
  const isNext = direction === "next";

  return (
    <motion.div
      initial={{ x: isNext ? 32 : -32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.55, delay, ease: EASE_OUT_EXPO }
      }
      whileHover={reduceMotion ? undefined : { x: isNext ? 4 : -4 }}
    >
      <Link
        href={href}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border border-border-default bg-card-warm/80 px-4 py-2 text-[12px] backdrop-blur transition",
          "hover:border-ink-warm/40 hover:text-ink",
          isNext ? "flex-row" : "flex-row-reverse",
        )}
      >
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.14em]",
            theme.text,
          )}
        >
          {isNext ? "Next" : "Previous"}
        </span>
        <span className="font-medium capitalize text-ink-warm">{label}</span>
        <ArrowRight
          className={cn(
            "size-3.5 text-subtle transition-transform",
            isNext
              ? "group-hover:translate-x-0.5"
              : "rotate-180 group-hover:-translate-x-0.5",
          )}
          strokeWidth={2}
        />
      </Link>
    </motion.div>
  );
}
