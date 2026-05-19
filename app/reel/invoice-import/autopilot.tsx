"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";

import { useReel } from "./_real/reel-state";

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

type ReelDispatch = ReturnType<typeof useReel>["dispatch"];

type Controls = {
  dispatch: ReelDispatch;
  setCursor: (c: CursorTarget | null) => void;
  setCaption: (c: Caption) => void;
  setScene: (id: string | null) => void;
  flash: () => void;
  sleep: (ms: number) => Promise<void>;
  isCancelled: () => boolean;
};

export function ReelDirectorProvider({ children }: { children: ReactNode }) {
  const { dispatch } = useReel();
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

    runScript(controls).catch(() => {});

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
    // ---- Reset to Bills tab ----
    c.dispatch({ type: "RESTART" });
    c.setCursor(null);

    // ---- Scene 0: Hero / Bills archive ----
    c.setScene("bills");
    c.setCaption({
      headline: "Stop typing invoices.",
      body: "Bills lists what's already posted. Imports is where new PDFs land.",
    });
    await c.sleep(2400);
    if (c.isCancelled()) return;

    // ---- Scene 1: Click "Bulk import" ----
    c.setCaption({
      headline: "Click Bulk import.",
      body: "Bills moves out of the way; the Imports tab takes over.",
    });
    c.setCursor({ selector: "[data-reel='bulk-import']", offsetX: 60, offsetY: 16 });
    await c.sleep(1100);
    c.flash();
    await c.sleep(220);
    c.dispatch({ type: "SET_TAB", tab: "inbox" });
    c.dispatch({ type: "SET_STEP", step: "imports-empty" });
    c.setCursor(null);
    await c.sleep(700);

    // ---- Scene 2: Empty Imports tab — drop a file ----
    c.setScene("imports-empty");
    c.setCaption({
      headline: "Drop in a supplier PDF.",
      body: "Single file or hundreds — they all import in parallel.",
    });
    c.setCursor({ selector: "[data-reel='dropzone']", offsetX: 320, offsetY: 130 });
    await c.sleep(1300);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "DROP_FILE" });
    c.setCursor(null);
    await c.sleep(400);

    // ---- Scene 3: Scanning animation ----
    c.setScene("imports-scanning");
    c.setCaption({
      headline: "AI reads the PDF.",
      body: "Header, line items, totals, and product matches — in seconds.",
    });
    await c.sleep(3200);
    c.dispatch({ type: "FINISH_SCAN" });
    if (c.isCancelled()) return;

    // ---- Scene 4: Imports queue populated ----
    c.setScene("imports-populated");
    c.setCaption({
      headline: "One file in the queue.",
      body: "Confidence, status, and the issues it found — at a glance.",
    });
    await c.sleep(2200);

    // ---- Scene 5: Click the file row ----
    c.setCursor({
      selector: "[data-reel='file-row-file_inv2847']",
      offsetX: 80,
      offsetY: 22,
    });
    await c.sleep(1000);
    c.flash();
    await c.sleep(180);
    c.dispatch({ type: "OPEN_REVIEW" });
    c.setCursor(null);
    await c.sleep(600);

    // ---- Scene 6: Review screen — overview ----
    c.setScene("review-overview");
    c.setCaption({
      headline: "The actual review screen.",
      body: "Source PDF on the left, parsed data on the right. Click any line to follow it across.",
    });
    await c.sleep(2000);

    // Hover a clean line to show the cross-pane highlight
    c.setCursor({ selector: "[data-reel='review-line-1']", offsetX: 120, offsetY: 28 });
    await c.sleep(700);
    c.dispatch({ type: "SET_ACTIVE_LINE", lineId: 1 });
    await c.sleep(1300);
    c.dispatch({ type: "SET_ACTIVE_LINE", lineId: null });
    await c.sleep(200);

    // ---- Scene 7: Pick supplier (Create supplier inline) ----
    c.setScene("supplier");
    c.setCaption({
      headline: "Supplier not in your catalog?",
      body: "Create it inline. Name + terms are extracted from the PDF.",
    });
    c.setCursor({ selector: "[data-reel='create-supplier']", offsetX: 50, offsetY: 8 });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({
      type: "PICK_SUPPLIER",
      supplierId: "sup_northwind",
      name: "Northwind Trading Co.",
    });
    await c.sleep(1500);

    // ---- Scene 8: Fix the partial-scan line (missing cost) ----
    c.setScene("fix-cost");
    c.setCaption({
      headline: "Fill in what AI missed.",
      body: "Line 2's cost didn't read — type 6.15 and the totals re-balance.",
    });
    c.setCursor({
      selector: "[data-reel='line-2-fill-cost']",
      offsetX: 40,
      offsetY: 14,
    });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "FILL_LINE_COST", lineId: 2, unitCost: 6.15 });
    await c.sleep(1500);

    // ---- Scene 9: Confirm suggestion + alias added ----
    c.setScene("suggestion");
    c.setCaption({
      headline: "Confirm a suggested match.",
      body: "Fluxora remembers — next invoice from this supplier matches automatically.",
    });
    c.setCursor({
      selector: "[data-reel='line-3-candidate-0']",
      offsetX: 60,
      offsetY: 16,
    });
    await c.sleep(1000);
    c.flash();
    await c.sleep(180);
    c.dispatch({
      type: "CONFIRM_SUGGESTION",
      lineId: 3,
      productId: "prod_bracket_l",
    });
    await c.sleep(1800);

    c.setCursor({
      selector: "[data-reel='line-4-candidate-0']",
      offsetX: 60,
      offsetY: 16,
    });
    await c.sleep(800);
    c.flash();
    await c.sleep(180);
    c.dispatch({
      type: "CONFIRM_SUGGESTION",
      lineId: 4,
      productId: "prod_fastener_kit",
    });
    await c.sleep(1600);

    // ---- Scene 10: Create new product on the unmatched line ----
    c.setScene("create-product");
    c.setCaption({
      headline: "New product? Create it from the line.",
      body: "Name, SKU, category, cost — all pre-filled.",
    });
    c.setCursor({
      selector: "[data-reel='line-5-create']",
      offsetX: 50,
      offsetY: 16,
    });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({
      type: "CREATE_PRODUCT_FOR_LINE",
      lineId: 5,
      productId: "prod_pa15_new",
    });
    await c.sleep(1500);

    // ---- Scene 11: Submit ----
    c.setScene("submit");
    c.setCaption({
      headline: "Submit & post.",
      body: "Stock, costs, aliases, and expense charges all commit at once.",
    });
    c.setCursor({ selector: "[data-reel='submit-review']", offsetX: 55, offsetY: 16 });
    await c.sleep(1200);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "SUBMIT_REVIEW" });
    c.setCursor(null);
    await c.sleep(1200);

    // ---- Scene 12: Back to Imports tab, row marked Reviewed ----
    c.setScene("reviewed");
    c.setCaption({
      headline: "Posted.",
      body: "Inventory's already updated. Aliases saved for next time.",
    });
    await c.sleep(2600);

    // ---- Outro ----
    c.setScene("outro");
    c.setCaption({
      headline: "Receive a PDF. Post a bill. Stock is current.",
      body: "Try it free →",
    });
    await c.sleep(2200);
    c.setCaption(null);
    await c.sleep(600);
  }
}
