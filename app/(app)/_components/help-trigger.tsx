"use client";

import { CircleHelp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  HelpSheet,
  type HelpSheetTicket,
} from "./help-sheet";

/** Event name used to open the cold-start product tour from anywhere. */
export const FLUXORA_OPEN_TOUR_EVENT = "fluxora:open-tour";

type Props = {
  tenantName: string;
  tenantSlug: string;
  planLabel: string;
  isPriorityPlan: boolean;
  version: string;
  tickets: HelpSheetTicket[];
};

export function HelpTrigger({
  tenantName,
  tenantSlug,
  planLabel,
  isPriorityPlan,
  version,
  tickets,
}: Props) {
  const [open, setOpen] = useState(false);

  // Open with `?` key when no input is focused
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key !== "?") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
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
      event.preventDefault();
      setOpen((prev) => !prev);
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  const handleStartTour = useCallback(() => {
    setOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(FLUXORA_OPEN_TOUR_EVENT));
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open help"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "grid size-8 place-items-center rounded-md border-[0.5px] border-border-soft bg-card text-ink-warm transition-colors hover:bg-card-warm hover:text-forest",
          open && "border-forest bg-forest text-card-warm hover:bg-forest-mid hover:text-card-warm",
        )}
      >
        <CircleHelp size={16} strokeWidth={1.5} aria-hidden />
      </button>
      <HelpSheet
        open={open}
        onOpenChange={setOpen}
        onStartTour={handleStartTour}
        tenantName={tenantName}
        tenantSlug={tenantSlug}
        planLabel={planLabel}
        isPriorityPlan={isPriorityPlan}
        version={version}
        tickets={tickets}
      />
    </>
  );
}
