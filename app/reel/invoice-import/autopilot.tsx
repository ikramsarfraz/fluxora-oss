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

type DirectorState = {
  cursor: CursorTarget | null;
  clickFlash: boolean;
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
    setState({ cursor: null, clickFlash: false, sceneId: null, isPaused: false });
    setRestartTick((t) => t + 1);
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    let cancelled = false;
    const controls: Controls = {
      dispatch,
      setCursor: (c) => setState((s) => ({ ...s, cursor: c })),
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

const TOTAL_CHAPTERS = 4;

async function runScript(c: Controls) {
  // Loop forever
  while (!c.isCancelled()) {
    // ---- Reset to Bills tab ----
    c.dispatch({ type: "RESTART" });
    c.setCursor(null);

    // ---- Opening splash ----
    // initialReelState() already starts with transition: { kind: "splash" },
    // so RESTART above puts us back to that state. Hold it briefly for the
    // viewer, then fade out.
    c.setScene("splash");
    // Hold the splash longer (3.7s instead of 3.2s) — gives it more
    // presence before the explainer takes over. The user explicitly
    // asked for a wait before the swap.
    await c.sleep(3700);
    if (c.isCancelled()) return;

    // ---- Explainer 1: frame the whole flow ----
    // No "none" handoff between back-to-back transitions — let the splash's
    // exit overlap with the explainer's entry so the surface never flashes
    // through. Same pattern below for every consecutive transition pair.
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "explainer",
        eyebrow: "What you'll see",
        title: "Drop. Confirm. Done.",
        visual: "pdf-to-stock",
        body:
          "Three steps. No spreadsheets. The AI does the typing, you do the judgment — and stock, costs, and aliases all update in a single submit.",
      },
    });
    await c.sleep(4200);

    // ---- Chapter 1: Receive ----
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "chapter",
        index: 1,
        total: TOTAL_CHAPTERS,
        title: "Receive",
        subtitle: "Drop a PDF into the queue",
      },
    });
    await c.sleep(1600);
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "none" } });

    // ---- Scene 0: Hero / Bills archive ----
    c.setScene("bills");
    await c.sleep(2400);
    if (c.isCancelled()) return;

    // ---- Scene 1: Click "Bulk import" ----
    // "Bulk import" button is ~110×32 (h-9 with the gap + icon + text)
    c.setCursor({ selector: "[data-reel='bulk-import']" });
    await c.sleep(1100);
    c.flash();
    await c.sleep(220);
    c.dispatch({ type: "SET_TAB", tab: "inbox" });
    c.dispatch({ type: "SET_STEP", step: "imports-empty" });
    c.setCursor(null);
    await c.sleep(700);

    // ---- Scene 2: Empty Imports tab — drop a file ----
    c.setScene("imports-empty");
    // Dropzone is the full hero card (~880×280). Land near the upload icon.
    c.setCursor({ selector: "[data-reel='dropzone']" });
    await c.sleep(1300);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "DROP_FILE" });
    c.setCursor(null);
    await c.sleep(400);

    // ---- Scene 3: Scanning animation ----
    c.setScene("imports-scanning");
    await c.sleep(2800);

    // Scanning result interstitial — small confirmation card before queue fills
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "interstitial",
        icon: "scan",
        title: "Parsed in 4.2 seconds",
        body: "9 line items · 1 supplier match needed · 1 cost spike detected",
      },
    });
    await c.sleep(1400);
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "none" } });

    c.dispatch({ type: "FINISH_SCAN" });
    if (c.isCancelled()) return;

    // ---- Scene 4: Imports queue populated ----
    c.setScene("imports-populated");
    await c.sleep(2200);

    // ---- Scene 5: Click the file row's Review button ----
    c.setCursor({
      selector: "[data-reel='file-row-file_inv2847-review-button']",
    });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "OPEN_REVIEW" });
    c.setCursor(null);
    await c.sleep(600);

    // ---- Explainer 2: how matching works ----
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "explainer",
        eyebrow: "How matching works",
        title: "AI suggests. You confirm.",
        visual: "ai-match",
        body:
          "Every line gets a confidence score. Spend your time on the 2 that need attention — not the 47 already right. Fluxora remembers your choices so the next invoice from this supplier matches itself.",
      },
    });
    await c.sleep(4400);

    // ---- Chapter 2: Review ----
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "chapter",
        index: 2,
        total: TOTAL_CHAPTERS,
        title: "Review",
        subtitle: "Match products, fix anything AI missed",
      },
    });
    await c.sleep(1600);
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "none" } });

    // ---- Scene 6: Review screen — overview + queue ----
    c.setScene("review-overview");
    await c.sleep(2400);

    // ---- Scene 7: Pick supplier — opens the production Create-supplier dialog ----
    c.setScene("supplier");
    c.setCursor({ selector: "[data-reel='create-supplier']" });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({
      type: "OPEN_DIALOG",
      dialog: { kind: "create-supplier", prefillName: "Northwind Trading Co." },
    });
    c.setCursor(null);
    // Let the user read the modal before the cursor moves.
    await c.sleep(2000);

    c.setCursor({ selector: "[data-reel='dialog-create-supplier-submit']" });
    await c.sleep(1200);
    c.flash();
    // Flip the dialog into its "Creating…" pending state so the user sees
    // the click register before the modal closes — matches production's
    // FormActionFooter UX. The cursor flash is visual-only; this is what
    // gives the click *consequence*.
    c.dispatch({ type: "SET_DIALOG_PENDING", pending: true });
    await c.sleep(800);

    c.dispatch({
      type: "PICK_SUPPLIER",
      supplierId: "sup_northwind",
      name: "Northwind Trading Co.",
    });
    c.dispatch({ type: "CLOSE_DIALOG" });
    c.setCursor(null);
    await c.sleep(500);

    // Interstitial: supplier linked
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "interstitial",
        icon: "sparkle",
        title: "Northwind Trading Co. created",
        body: "Linked to this bill · Net-30 terms saved for next time.",
      },
    });
    await c.sleep(1500);
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "none" } });

    // ---- Scene 7b: Collapse the invoice header ----
    c.setScene("collapse-header");
    c.setCursor({ selector: "[data-reel='collapse-header']" });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "SET_HEADER_COLLAPSED", collapsed: true });
    c.setCursor(null);
    await c.sleep(1000);

    // ---- Scene 8: Fix the partial-scan line (missing cost) ----
    c.setScene("fix-cost");
    c.setCursor({ selector: "[data-reel='line-2-fill-cost']" });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "FILL_LINE_COST", lineId: 2, unitCost: 6.15 });
    await c.sleep(1500);

    // ---- Scene 9: Confirm suggestion + alias added ----
    c.setScene("suggestion");
    c.setCursor({ selector: "[data-reel='line-3-candidate-0']" });
    await c.sleep(1000);
    c.flash();
    await c.sleep(180);
    c.dispatch({
      type: "CONFIRM_SUGGESTION",
      lineId: 3,
      productId: "prod_bracket_l",
    });
    await c.sleep(1800);

    c.setCursor({ selector: "[data-reel='line-4-candidate-0']" });
    await c.sleep(800);
    c.flash();
    await c.sleep(180);
    c.dispatch({
      type: "CONFIRM_SUGGESTION",
      lineId: 4,
      productId: "prod_fastener_kit",
    });
    await c.sleep(1600);

    // ---- Scene 10: Create new product — opens the production dialog ----
    c.setScene("create-product");
    c.setCursor({ selector: "[data-reel='line-5-create']" });
    await c.sleep(1100);
    c.flash();
    await c.sleep(200);
    c.dispatch({
      type: "OPEN_DIALOG",
      dialog: {
        kind: "create-product",
        lineId: 5,
        prefillName: 'Pneumatic actuator — 1.5" stroke',
      },
    });
    c.setCursor(null);
    // Product dialog has more fields than supplier — give it longer to read.
    await c.sleep(2400);

    c.setCursor({ selector: "[data-reel='dialog-create-product-submit']" });
    await c.sleep(1200);
    c.flash();
    c.dispatch({ type: "SET_DIALOG_PENDING", pending: true });
    await c.sleep(800);

    c.dispatch({
      type: "CREATE_PRODUCT_FOR_LINE",
      lineId: 5,
      productId: "prod_pa15_new",
    });
    c.dispatch({ type: "CLOSE_DIALOG" });
    c.setCursor(null);
    await c.sleep(500);

    // Interstitial: all lines matched
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "interstitial",
        icon: "check",
        title: "All lines matched",
        body: "5 to products you already had · 1 brand-new · 3 fees · aliases saved.",
      },
    });
    await c.sleep(1700);

    // ---- Explainer 3: what submit does ----
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "explainer",
        eyebrow: "What submit does",
        title: "One click. Five updates.",
        visual: "five-effects",
        body:
          "Stock rises. Costs update. Aliases save for next time. Non-inventory charges hit the right expense accounts. The bill ships to AP — all in a single transaction.",
      },
    });
    await c.sleep(4400);

    // ---- Chapter 3: Post ----
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "chapter",
        index: 3,
        total: TOTAL_CHAPTERS,
        title: "Post",
        subtitle: "Stock, costs, aliases all commit at once",
      },
    });
    await c.sleep(1600);
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "none" } });

    // ---- Scene 11: Submit ----
    c.setScene("submit");
    c.setCursor({ selector: "[data-reel='submit-review']" });
    await c.sleep(1200);
    c.flash();
    await c.sleep(200);
    c.dispatch({ type: "SUBMIT_REVIEW" });
    c.setCursor(null);
    await c.sleep(900);

    // Interstitial: posted
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "interstitial",
        icon: "package",
        title: "Posted · Stock updated",
        body: "5 products received · 2 aliases saved · 3 expense charges posted.",
      },
    });
    await c.sleep(1700);

    // ---- Chapter 4: Done ----
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "chapter",
        index: 4,
        total: TOTAL_CHAPTERS,
        title: "Done",
        subtitle: "Row moves to Reviewed, stock is current",
      },
    });
    await c.sleep(1600);
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "none" } });

    // ---- Scene 12: Back to Imports tab, row marked Reviewed ----
    c.setScene("reviewed");
    await c.sleep(2200);

    // ---- Explainer 4: what gets remembered ----
    c.dispatch({
      type: "SET_TRANSITION",
      transition: {
        kind: "explainer",
        eyebrow: "Next time",
        title: "Fluxora remembers.",
        visual: "memory",
        body:
          "Every product alias, supplier alias, and cost pattern is saved. The next invoice from this supplier walks in already matched — you just confirm and submit.",
      },
    });
    await c.sleep(4200);

    // ---- Outro splash ----
    c.setScene("outro");
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "outro" } });
    await c.sleep(3800);
    c.dispatch({ type: "SET_TRANSITION", transition: { kind: "none" } });
    await c.sleep(600);
  }
}
