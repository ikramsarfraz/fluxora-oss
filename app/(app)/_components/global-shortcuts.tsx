"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Global keyboard chord handler for the tenant app shell.
 *
 * Listens for "N then X" sequences (Linear/GitHub style) and navigates to
 * the matching `/new` route. The chord resets after 1.5s if no follow-up
 * key is pressed. Ignored while a text input is focused.
 *
 * Keep this list in sync with `lib/shortcuts.ts` so the help drawer never
 * advertises a shortcut that doesn't actually fire here.
 */
const N_CHORD_DESTINATIONS: Record<string, string> = {
  o: "/orders/new",
  b: "/supplier-invoices/new",
  e: "/expenses/new",
};

const CHORD_TIMEOUT_MS = 1500;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function GlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let chordOpen = false;
    let chordTimer: number | undefined;

    function resetChord() {
      chordOpen = false;
      if (chordTimer !== undefined) {
        window.clearTimeout(chordTimer);
        chordTimer = undefined;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (chordOpen) {
        const dest = N_CHORD_DESTINATIONS[key];
        if (dest) {
          event.preventDefault();
          router.push(dest);
        }
        resetChord();
        return;
      }

      if (key === "n") {
        event.preventDefault();
        chordOpen = true;
        chordTimer = window.setTimeout(resetChord, CHORD_TIMEOUT_MS);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      resetChord();
    };
  }, [router]);

  return null;
}
