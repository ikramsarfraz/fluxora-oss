"use client";

import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import {
  REVIEW_DATA,
  batchView,
  emptyView,
  initialReelState,
  reviewedFileView,
} from "./mock-data";
import type {
  DialogKind,
  ReelState,
  ReelStep,
  ReviewLine,
  Tab,
  Transition,
} from "./types";

type Action =
  | { type: "SET_STEP"; step: ReelStep }
  | { type: "SET_TAB"; tab: Tab }
  | { type: "DROP_FILE" }
  | { type: "FINISH_SCAN" }
  | { type: "OPEN_REVIEW" }
  | { type: "SET_ACTIVE_LINE"; lineId: number | null }
  | { type: "SET_HEADER_COLLAPSED"; collapsed: boolean }
  | { type: "OPEN_DIALOG"; dialog: DialogKind }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_TRANSITION"; transition: Transition }
  | { type: "PICK_SUPPLIER"; supplierId: string; name: string }
  | { type: "FILL_LINE_COST"; lineId: number; unitCost: number }
  | { type: "CONFIRM_SUGGESTION"; lineId: number; productId: string }
  | { type: "CREATE_PRODUCT_FOR_LINE"; lineId: number; productId: string }
  | { type: "SUBMIT_REVIEW" }
  | { type: "RESTART" };

function reducer(state: ReelState, action: Action): ReelState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "DROP_FILE":
      return {
        ...state,
        step: "imports-scanning",
        activeTab: "inbox",
        view: batchView(),
      };
    case "FINISH_SCAN":
      return { ...state, step: "imports-populated" };
    case "OPEN_REVIEW":
      return {
        ...state,
        step: "review",
        review: { ...REVIEW_DATA, lines: REVIEW_DATA.lines.map((l) => ({ ...l })) },
      };
    case "SET_ACTIVE_LINE":
      return { ...state, activeLineId: action.lineId };
    case "SET_HEADER_COLLAPSED":
      return { ...state, headerCollapsed: action.collapsed };
    case "OPEN_DIALOG":
      return { ...state, dialog: action.dialog };
    case "CLOSE_DIALOG":
      return { ...state, dialog: { kind: "none" } };
    case "SET_TRANSITION":
      return { ...state, transition: action.transition };
    case "PICK_SUPPLIER":
      if (!state.review) return state;
      return {
        ...state,
        review: {
          ...state.review,
          supplierId: action.supplierId,
          supplierTypedName: action.name,
        },
      };
    case "FILL_LINE_COST":
      if (!state.review) return state;
      return {
        ...state,
        review: {
          ...state.review,
          lines: state.review.lines.map((l): ReviewLine =>
            l.id === action.lineId
              ? {
                  ...l,
                  unitCost: action.unitCost,
                  total: Number((action.unitCost * l.qty).toFixed(2)),
                  flags: (l.flags ?? []).filter((f) => f !== "partial-scan"),
                }
              : l,
          ),
        },
      };
    case "CONFIRM_SUGGESTION":
      if (!state.review) return state;
      return {
        ...state,
        review: {
          ...state.review,
          lines: state.review.lines.map((l): ReviewLine =>
            l.id === action.lineId
              ? { ...l, match: { kind: "matched", productId: action.productId, aliasAdded: true } }
              : l,
          ),
        },
      };
    case "CREATE_PRODUCT_FOR_LINE":
      if (!state.review) return state;
      return {
        ...state,
        review: {
          ...state.review,
          lines: state.review.lines.map((l): ReviewLine =>
            l.id === action.lineId
              ? { ...l, match: { kind: "matched", productId: action.productId, aliasAdded: false } }
              : l,
          ),
        },
      };
    case "SUBMIT_REVIEW":
      return {
        ...state,
        step: "imports-reviewed",
        view: reviewedFileView(),
        review: null,
        activeTab: "inbox",
      };
    case "RESTART":
      return initialReelState();
  }
}

type Ctx = {
  state: ReelState;
  dispatch: Dispatch<Action>;
};

const ReelContext = createContext<Ctx | null>(null);

export function ReelStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialReelState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ReelContext.Provider value={value}>{children}</ReelContext.Provider>;
}

export function useReel(): Ctx {
  const ctx = useContext(ReelContext);
  if (!ctx) throw new Error("useReel must be used inside ReelStateProvider");
  return ctx;
}

export function useReelDispatch(): Dispatch<Action> {
  return useReel().dispatch;
}

// Keep emptyView reachable via this barrel so the surface can hide the populated
// imports view between steps if it ever needs to (currently the reducer manages it).
export { emptyView };
