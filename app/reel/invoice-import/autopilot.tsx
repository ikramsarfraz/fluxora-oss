"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { INITIAL_FILE } from "@/app/(app)/invoice-import/_demo/mock-data";
import { useDemo } from "@/app/(app)/invoice-import/_demo/state";

type CursorTarget =
  | { selector: string; offsetX?: number; offsetY?: number }
  | { x: number; y: number };

type Caption = { headline: string; body?: string } | null;

type DirectorState = {
  cursor: CursorTarget | null;
  clickFlash: boolean;
  caption: Caption;
  sceneId: string | null;
  isPaused: boolean;
};

type DirectorContextValue = DirectorState & {
  togglePause: () => void;
  restart: () => void;
};

const DirectorContext = createContext<DirectorContextValue | null>(null);

export function useReelDirector(): DirectorContextValue {
  const ctx = useContext(DirectorContext);
  if (!ctx) throw new Error("useReelDirector must be used inside ReelDirectorProvider");
  return ctx;
}

type Controls = {
  dispatch: ReturnType<typeof useDemo>["dispatch"];
  setCursor: (c: CursorTarget | null) => void;
  setCaption: (c: Caption) => void;
  setScene: (id: string | null) => void;
  flash: () => void;
  sleep: (ms: number) => Promise<void>;
  isCancelled: () => boolean;
};

export function ReelDirectorProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useDemo();
  const [state, setState] = useState<DirectorState>({
    cursor: null,
    clickFlash: false,
    caption: null,
    sceneId: null,
    isPaused: false,
  });
  const [restartTick, setRestartTick] = useState(0);
  const pausedRef = useRef(false);
  const cancelRef = useRef(false);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setState((s) => ({ ...s, isPaused: pausedRef.current }));
  }, []);

  const restart = useCallback(() => {
    cancelRef.current = true;
    pausedRef.current = false;
    setState({ cursor: null, clickFlash: false, caption: null, sceneId: null, isPaused: false });
    setRestartTick((t) => t + 1);
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    let cancelled = false;
    const controls: Controls = {
      dispatch,
      setCursor: (c) => setState((s) => ({ ...s, cursor: c })),
      setCaption: (c) => setState((s) => ({ ...s, caption: c })),
      setScene: (id) => setState((s) => ({ ...s, sceneId: id })),
      flash: () => {
        setState((s) => ({ ...s, clickFlash: true }));
        window.setTimeout(() => setState((s) => ({ ...s, clickFlash: false })), 280);
      },
      sleep: async (ms: number) => {
        const start = performance.now();
        while (performance.now() - start < ms) {
          await new Promise((r) => window.setTimeout(r, 60));
          while (pausedRef.current && !cancelRef.current && !cancelled) {
            await new Promise((r) => window.setTimeout(r, 100));
          }
          if (cancelRef.current || cancelled) return;
        }
      },
      isCancelled: () => cancelRef.current || cancelled,
    };

    runScript(controls).catch(() => {
      // Cancelled or interrupted — ignore.
    });

    return () => {
      cancelled = true;
      cancelRef.current = true;
    };
  }, [restartTick, dispatch]);

  const value = useMemo<DirectorContextValue>(
    () => ({ ...state, togglePause, restart }),
    [state, togglePause, restart],
  );

  return <DirectorContext.Provider value={value}>{children}</DirectorContext.Provider>;
}

async function runScript(c: Controls) {
  // Loop forever
  while (!c.isCancelled()) {
    // ---- Scene 0: Reset to inventory ----
    c.setScene("inventory");
    c.dispatch({ type: "RESTART" });
    c.setCaption({
      headline: "Stop typing invoices into your ERP.",
      body: "Drop a supplier PDF — Fluxora handles the rest.",
    });
    c.setCursor(null);
    await c.sleep(2400);
    if (c.isCancelled()) return;

    // ---- Scene 1: Click "Import invoice" ----
    c.setCursor({ selector: "[data-reel='import-invoice']", offsetX: 60, offsetY: 16 });
    await c.sleep(1100);
    c.flash();
    await c.sleep(220);
    c.dispatch({ type: "SET_STEP", step: "upload" });
    c.setCursor(null);
    await c.sleep(500);

    // ---- Scene 2: Upload ----
    c.setScene("upload");
    c.setCaption({
      headline: "Drop in a supplier PDF.",
      body: "Single file or hundreds — they all import in parallel.",
    });
    // Land on the cloud icon, roughly centered horizontally
    c.setCursor({ selector: "[data-reel='dropzone']", offsetX: 260, offsetY: 70 });
    await c.sleep(1100);
    c.flash();
    await c.sleep(180);
    c.dispatch({ type: "ADD_FILES", files: [INITIAL_FILE] });
    await c.sleep(900);

    c.setCursor({ selector: "[data-reel='start-import']", offsetX: 50, offsetY: 16 });
    await c.sleep(900);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "SET_STEP", step: "scanning" });
    c.setCursor(null);
    await c.sleep(300);

    // ---- Scene 3: Scanning auto-plays ----
    c.setScene("scanning");
    c.setCaption({
      headline: "AI reads the PDF.",
      body: "Header, line items, totals, and product matches — in seconds.",
    });
    // ScanningStep auto-transitions to queue after ~4–5 s
    await c.sleep(5200);
    if (c.isCancelled()) return;

    // ---- Scene 4: Queue ----
    c.setScene("queue");
    c.setCaption({
      headline: "Imports queued for review.",
      body: "Open one to confirm matches and resolve any issues.",
    });
    await c.sleep(1200);
    // Land on the supplier name cell, not the middle of the wide row
    c.setCursor({ selector: "[data-reel='queue-row-first']", offsetX: 60, offsetY: 22 });
    await c.sleep(1000);
    c.flash();
    await c.sleep(180);
    c.dispatch({ type: "SELECT_INVOICE", invoiceId: "inv_2847" });
    c.dispatch({ type: "SET_STEP", step: "review" });
    c.setCursor(null);
    await c.sleep(700);

    // ---- Scene 5: Review — overview ----
    c.setScene("review-overview");
    c.setCaption({
      headline: "Extracted data, alongside the source.",
      body: "Hover any line to see where it came from on the PDF.",
    });
    await c.sleep(1600);

    // ---- Scene 6: Line highlight demo ----
    c.setCursor({ selector: "[data-reel='line-line_1']", offsetX: 110, offsetY: 22 });
    await c.sleep(700);
    c.dispatch({ type: "SET_HIGHLIGHT", lineId: "line_1" });
    await c.sleep(1300);
    c.dispatch({ type: "SET_HIGHLIGHT", lineId: null });
    await c.sleep(200);

    // ---- Scene 7: Pick / create supplier ----
    c.setScene("supplier");
    c.setCaption({
      headline: "Supplier not in your catalog? Create it inline.",
      body: "Name, terms, currency — extracted and pre-filled.",
    });
    c.setCursor({ selector: "[data-reel='supplier-trigger']", offsetX: 80, offsetY: 18 });
    await c.sleep(1100);
    c.flash();
    await c.sleep(220);
    c.dispatch({
      type: "CREATE_SUPPLIER",
      supplier: {
        id: "sup_northwind",
        name: "Northwind Trading Co.",
        defaultCurrency: "USD",
        netDays: 30,
      },
    });
    await c.sleep(1400);

    // ---- Scene 8: Fix missing cost (line_2) ----
    c.setScene("fix-cost");
    c.setCaption({
      headline: "Edit anything inline.",
      body: "Line had a partial scan — fill in the cost and the total recomputes.",
    });
    c.setCursor({ selector: "[data-reel='line-line_2-cost']", offsetX: 40, offsetY: 16 });
    await c.sleep(900);
    c.flash();
    await c.sleep(200);
    c.dispatch({
      type: "UPDATE_LINE",
      lineId: "line_2",
      patch: { unitCost: 6.15, total: 221.4 },
    });
    await c.sleep(1300);

    // ---- Scene 9: Confirm suggestion + alias ----
    c.setScene("suggestion");
    c.setCaption({
      headline: "Confirm a suggested match.",
      body: "Fluxora remembers — next invoice from this supplier matches automatically.",
    });
    c.setCursor({ selector: "[data-reel='line-line_3-picker']", offsetX: 70, offsetY: 22 });
    await c.sleep(1000);
    c.flash();
    await c.sleep(180);
    c.dispatch({ type: "CONFIRM_SUGGESTION", lineId: "line_3", productId: "prod_bracket_l" });
    await c.sleep(2000);

    c.setCursor({ selector: "[data-reel='line-line_4-picker']", offsetX: 70, offsetY: 22 });
    await c.sleep(800);
    c.flash();
    await c.sleep(180);
    c.dispatch({ type: "CONFIRM_SUGGESTION", lineId: "line_4", productId: "prod_fastener_kit" });
    await c.sleep(1600);

    // ---- Scene 10: Create new product inline ----
    c.setScene("create-product");
    c.setCaption({
      headline: "New product? Create it from the line.",
      body: "Name, SKU, category, unit, cost — all suggested.",
    });
    c.setCursor({ selector: "[data-reel='line-line_5-create']", offsetX: 60, offsetY: 16 });
    await c.sleep(1200);
    c.flash();
    await c.sleep(200);
    c.dispatch({
      type: "CREATE_PRODUCT",
      lineId: "line_5",
      draft: {
        name: 'Pneumatic actuator — 1.5" stroke',
        sku: "PA-1.5-NW",
        category: "Drive components",
        unit: "each",
        cost: 62.5,
      },
    });
    await c.sleep(1400);

    // ---- Scene 11: Save ----
    c.setScene("save");
    c.setCaption({
      headline: "Save once. Everything updates.",
      body: "Stock, costs, aliases, and expense charges in a single commit.",
    });
    c.setCursor({ selector: "[data-reel='save']", offsetX: 55, offsetY: 16 });
    await c.sleep(1200);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "SET_STEP", step: "saving" });
    c.setCursor(null);
    // SaveStep auto-commits after ~1100ms
    await c.sleep(1500);
    if (c.isCancelled()) return;

    // ---- Scene 12: Saved ----
    c.setScene("saved");
    c.setCaption({
      headline: "Imported.",
      body: "Products created, stock updated, aliases saved, charges posted.",
    });
    await c.sleep(2400);

    // ---- Scene 13: Back to inventory ----
    c.dispatch({ type: "SET_STEP", step: "saved" });
    await c.sleep(900);
    c.setScene("inventory-post");
    c.setCaption({
      headline: "Back in inventory — already updated.",
      body: "Newly affected rows are quietly marked.",
    });
    await c.sleep(2800);

    // ---- Outro ----
    c.setScene("outro");
    c.setCaption({
      headline: "Receive a PDF. Save an invoice. Stock is current.",
      body: "Try it free →",
    });
    await c.sleep(2200);
    c.setCaption(null);
    await c.sleep(600);
  }
}
