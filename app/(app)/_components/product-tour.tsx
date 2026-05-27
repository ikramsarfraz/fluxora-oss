"use client";

import { X } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  markTourComplete,
  tourById,
  TOURS,
  type TourDefinition,
  type TourId,
} from "@/lib/tour/registry";
import type { TourLiveStep, TourStep } from "@/lib/tour/types";
import { cn } from "@/lib/utils";

import styles from "./product-tour.module.css";

const FLUXORA_OPEN_TOUR_EVENT = "fluxora:open-tour";

const COACH_W = 380;
const COACH_EST_H = 240;
const MARGIN = 16;

type TargetRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

function isFinishOrCloseable(step: TourStep): step is TourLiveStep {
  return step.kind === "live";
}

export function ProductTour() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);
  // Which tour is active. Defaults to the cold-start dashboard tour so any
  // existing CTA that dispatches the event with no detail keeps working.
  const [activeTour, setActiveTour] = useState<TourDefinition>(
    TOURS["cold-start"],
  );

  const steps = useMemo(() => activeTour.steps, [activeTour]);
  const liveStepCount = useMemo(
    () => steps.filter((s) => s.kind === "live").length,
    [steps],
  );

  const [rect, setRect] = useState<TargetRect>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    visible: false,
  });
  const [coachPos, setCoachPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  const coachRef = useRef<HTMLDivElement | null>(null);

  // Listen for tour-open event globally. The event detail can carry a
  // `tour` id to select a non-default tour ("orders-new", "bills-new"); a
  // missing detail keeps the cold-start tour as the default so legacy
  // dispatches still work.
  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<{ tour?: TourId }>).detail;
      const tour = tourById(detail?.tour) ?? TOURS["cold-start"];
      setActiveTour(tour);
      setCurrent(0);
      setOpen(true);
    }
    window.addEventListener(FLUXORA_OPEN_TOUR_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(FLUXORA_OPEN_TOUR_EVENT, handler as EventListener);
  }, []);

  const computePositions = useCallback(() => {
    const step = steps[current];
    if (!step) return;
    if (step.kind === "done") {
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      const vh = typeof window !== "undefined" ? window.innerHeight : 768;
      const cardH = coachRef.current?.offsetHeight ?? COACH_EST_H;
      setRect((prev) => ({ ...prev, visible: false, w: 0, h: 0 }));
      setCoachPos({
        left: Math.max(16, (vw - COACH_W) / 2),
        top: Math.max(16, (vh - cardH) / 2),
      });
      return;
    }

    const target = document.querySelector(step.target);
    if (!(target instanceof HTMLElement)) {
      setRect({ x: 0, y: 0, w: 0, h: 0, visible: false });
      const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
      const vh = typeof window !== "undefined" ? window.innerHeight : 768;
      setCoachPos({
        left: Math.max(16, (vw - COACH_W) / 2),
        top: Math.max(16, (vh - COACH_EST_H) / 2),
      });
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const r = target.getBoundingClientRect();
    const pad = step.pad ?? 6;
    const x = r.left - pad;
    const y = r.top - pad;
    const w = r.width + pad * 2;
    const h = r.height + pad * 2;
    setRect({ x, y, w, h, visible: true });

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardH = coachRef.current?.offsetHeight ?? COACH_EST_H;
    let cx = 0;
    let cy = 0;
    switch (step.placement) {
      case "right":
        cx = x + w + MARGIN;
        cy = y;
        break;
      case "left":
        cx = x - COACH_W - MARGIN;
        cy = y;
        break;
      case "top":
        cx = x + clamp((w - COACH_W) / 2, 0, 40);
        cy = y - cardH - MARGIN;
        break;
      case "bottom":
      default:
        cx = x + clamp((w - COACH_W) / 2, 0, 40);
        cy = y + h + MARGIN;
        break;
    }
    cx = clamp(cx, 16, vw - COACH_W - 16);
    cy = clamp(cy, 16, vh - 80);
    setCoachPos({ left: cx, top: cy });
  }, [current, steps]);

  useLayoutEffect(() => {
    if (!open) return;
    // Intentional: measuring the spotlight target's bounding rect and
    // positioning the coach card must happen synchronously before paint
    // to avoid a one-frame flicker where the card lands at (0,0) before
    // its real position resolves. `computePositions` reads the DOM and
    // calls setRect + setCoachPos; the eslint rule flags this as a
    // "cascading render" risk but the cascade is bounded and intentional
    // (single re-render per step change). Both setters live inside
    // computePositions; refactoring to derive these via useMemo isn't
    // possible because the values depend on live DOM measurements that
    // useMemo can't observe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    computePositions();
  }, [open, current, computePositions]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      computePositions();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [open, computePositions]);

  const close = useCallback(
    (markComplete: boolean) => {
      if (markComplete) markTourComplete(activeTour.id);
      setOpen(false);
    },
    [activeTour],
  );

  const next = useCallback(() => {
    setCurrent((c) => Math.min(c + 1, steps.length - 1));
  }, [steps.length]);

  const back = useCallback(() => {
    setCurrent((c) => Math.max(c - 1, 0));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, next, back]);

  if (!open) return null;

  const step = steps[current];
  if (!step) return null;

  const liveIndex = isFinishOrCloseable(step) ? current : -1;
  const liveStepNumber = liveIndex + 1;

  const isLastLiveStep =
    isFinishOrCloseable(step) && liveStepNumber === liveStepCount;
  const isDone = step.kind === "done";

  return (
    <>
      <div className={cn(styles.overlay, styles.active)}>
        {/* SVG mask with punched-out hole */}
        <div className={styles.mask} aria-hidden>
          <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <defs>
              <mask id="fluxora-tour-hole">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.visible ? rect.w : 0}
                  height={rect.visible ? rect.h : 0}
                  rx={8}
                  ry={8}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(26,26,20,0.58)"
              mask="url(#fluxora-tour-hole)"
            />
          </svg>
        </div>

        {/* Gold glow ring around the spotlight target */}
        <div
          className={styles.ring}
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            opacity: rect.visible ? 1 : 0,
          }}
          aria-hidden
        />

        {/* Coach card */}
        <div
          ref={coachRef}
          className={styles.coach}
          data-placement={isDone ? "center" : step.placement}
          style={{ left: coachPos.left, top: coachPos.top }}
          role="dialog"
          aria-labelledby="fluxora-tour-title"
        >
          <span className={styles.arrow} aria-hidden />
          <div className="flex items-center gap-[10px] px-[18px] pb-[10px] pt-4">
            <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-gold-deep">
              <span
                aria-hidden
                className="inline-block size-[5px] rounded-full bg-gold"
              />
              {step.label}
            </span>
            <span className="ml-auto font-mono text-[10.5px] tracking-[0.04em] text-subtle">
              {isDone ? (
                <span className="font-medium text-ink">✓</span>
              ) : (
                <>
                  <span className="font-medium text-ink">
                    {liveStepNumber}
                  </span>{" "}
                  / {liveStepCount}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => close(false)}
              className="ml-[6px] grid size-6 place-items-center rounded-sm text-subtle transition-colors hover:bg-surface hover:text-ink"
              aria-label="End tour"
            >
              <X size={14} strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          <div className={cn("px-[18px] pb-[14px]", styles.coachBody)}>
            {isDone ? (
              <div
                aria-hidden
                className="mb-[10px] grid size-9 place-items-center rounded-full border-[0.5px] border-success-border bg-success-bg font-mono text-[18px] font-semibold text-success-fg"
              >
                ✓
              </div>
            ) : null}
            <h3
              id="fluxora-tour-title"
              className="mb-[6px] text-[17px] font-semibold leading-[1.25] tracking-[-0.015em] text-ink"
              dangerouslySetInnerHTML={{ __html: step.title }}
            />
            <p
              className="text-[13.5px] leading-[1.55] text-ink-warm"
              dangerouslySetInnerHTML={{ __html: step.text }}
            />
            {step.kind === "live" && step.hint ? (
              <div className="mt-[10px] flex items-start gap-2 rounded-r-sm border-[0.5px] border-l-2 border-border-soft border-l-gold bg-card-warm px-3 py-[9px]">
                <span className="shrink-0 font-mono text-[12px] leading-[1.5] text-gold-deep">
                  {step.hint.icon}
                </span>
                <span
                  className="text-[12.5px] leading-[1.5] text-ink-warm"
                  dangerouslySetInnerHTML={{ __html: step.hint.text }}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 rounded-b-lg border-t-[0.5px] border-border-soft bg-surface px-4 py-3">
            <div className="mr-auto flex items-center gap-[5px]">
              {steps
                .filter((s) => s.kind === "live")
                .map((_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={cn(
                      styles.dot,
                      i === liveIndex && styles.active,
                      liveIndex >= 0 && i < liveIndex && styles.done,
                    )}
                  />
                ))}
            </div>
            <button
              type="button"
              onClick={() => close(true)}
              className="border-b-[0.5px] border-transparent py-[6px] font-mono text-[11px] tracking-[0.04em] text-subtle transition-colors hover:border-border-default hover:text-ink"
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={back}
              disabled={current === 0}
              className="inline-flex items-center justify-center gap-[6px] rounded-md border-[0.5px] border-border-default bg-card px-3 py-[7px] text-[12.5px] font-medium text-ink transition-colors hover:bg-card-warm disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Back
            </button>
            {isDone ? (
              <Link
                href={step.primaryCta.href}
                onClick={() => close(true)}
                className="inline-flex items-center justify-center gap-[6px] rounded-md bg-forest px-3 py-[7px] text-[12.5px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
              >
                {step.primaryCta.label}
              </Link>
            ) : isLastLiveStep ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center justify-center gap-[6px] rounded-md bg-forest px-3 py-[7px] text-[12.5px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
              >
                Finish →
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="inline-flex items-center justify-center gap-[6px] rounded-md bg-forest px-3 py-[7px] text-[12.5px] font-medium text-card-warm transition-colors hover:bg-forest-mid"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top-right HUD pill */}
      <div className="fixed right-4 top-4 z-[110] inline-flex items-center gap-2 rounded-full bg-ink px-[14px] py-2 pl-3 font-mono text-[11px] tracking-[0.04em] text-card-warm shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <span
          aria-hidden
          className="inline-block size-[7px] rounded-full bg-gold shadow-[0_0_0_3px_rgba(201,169,97,0.22)]"
        />
        <span className="text-forest-tint">
          Product tour ·{" "}
          <span className="text-card-warm">{activeTour.label}</span>
        </span>
        <span aria-hidden className="opacity-35">
          /
        </span>
        <button
          type="button"
          onClick={() => close(true)}
          className="ml-[6px] border-b-[0.5px] border-card-warm/40 pb-[1px] text-card-warm transition-colors hover:border-card-warm"
        >
          End
        </button>
      </div>
    </>
  );
}
