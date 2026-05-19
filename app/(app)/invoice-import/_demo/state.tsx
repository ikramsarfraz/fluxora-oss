"use client";

import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";

import {
  createInitialState,
  lineSubtotal,
  NORTHWIND_INVOICE,
} from "./mock-data";
import type {
  DemoState,
  DemoStep,
  FileScanStage,
  ImportedInvoice,
  LineItem,
  MatchState,
  NewProductDraft,
  NonInventoryCategory,
  Product,
  SaveSummary,
  Supplier,
  UploadedFile,
} from "./types";

type Action =
  | { type: "SET_STEP"; step: DemoStep }
  | { type: "ADD_FILES"; files: UploadedFile[] }
  | { type: "REMOVE_FILE"; fileId: string }
  | { type: "SET_FILE_STAGE"; fileId: string; stage: FileScanStage; progress: number }
  | { type: "INGEST_INVOICES" }
  | { type: "SELECT_INVOICE"; invoiceId: string | null }
  | { type: "UPDATE_LINE"; lineId: string; patch: Partial<LineItem> }
  | {
      type: "UPDATE_HEADER";
      patch: Partial<
        Pick<
          ImportedInvoice,
          "supplierId" | "supplierName" | "invoiceNumber" | "invoiceDate" | "dueDate" | "currency"
        >
      >;
    }
  | { type: "CONFIRM_SUGGESTION"; lineId: string; productId: string }
  | {
      type: "SET_LINE_MATCH";
      lineId: string;
      productId: string | null;
      matchState: MatchState;
    }
  | { type: "CREATE_PRODUCT"; lineId: string; draft: NewProductDraft }
  | { type: "UPDATE_DRAFT"; lineId: string; patch: Partial<NewProductDraft> }
  | { type: "SET_LINE_KIND"; lineId: string; kind: "inventory" | "non-inventory" }
  | {
      type: "SET_NON_INVENTORY";
      lineId: string;
      category: NonInventoryCategory;
      expenseAccount: string;
    }
  | { type: "CREATE_SUPPLIER"; supplier: Supplier }
  | { type: "COMMIT_INVOICE"; invoiceId: string }
  | { type: "SET_HIGHLIGHT"; lineId: string | null }
  | { type: "RESTART" };

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };

    case "ADD_FILES":
      return { ...state, files: [...state.files, ...action.files] };

    case "REMOVE_FILE":
      return { ...state, files: state.files.filter((f) => f.id !== action.fileId) };

    case "SET_FILE_STAGE":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.fileId ? { ...f, stage: action.stage, progress: action.progress } : f,
        ),
      };

    case "INGEST_INVOICES": {
      const existingIds = new Set(state.invoices.map((i) => i.id));
      const next: ImportedInvoice[] = [];
      for (const file of state.files) {
        if (file.id === NORTHWIND_INVOICE.fileId) {
          if (!existingIds.has(NORTHWIND_INVOICE.id)) {
            next.push({ ...NORTHWIND_INVOICE, lines: NORTHWIND_INVOICE.lines.map((l) => ({ ...l })) });
          }
        } else if (file.id === "file_inv2848") {
          if (!existingIds.has("inv_2851")) {
            next.push({
              id: "inv_2851",
              fileId: file.id,
              filename: file.filename,
              supplierName: "Apex Industrial Supply",
              supplierId: "sup_apex",
              invoiceNumber: "INV-2851",
              invoiceDate: "2026-05-14",
              dueDate: "2026-06-13",
              currency: "USD",
              declaredTotal: 412.6,
              headerIssues: [],
              status: "ready",
              lines: [
                {
                  id: "line_2851_1",
                  pdfRowIndex: 0,
                  description: "Grease lube 32oz",
                  qty: 12,
                  unitCost: 11.2,
                  total: 134.4,
                  kind: "inventory",
                  matchState: "auto-matched",
                  matchedProductId: "prod_grease_can",
                  suggestions: [],
                  confidence: 0.95,
                  rawMatchHint: "alias: Grease lube 32oz",
                },
                {
                  id: "line_2851_2",
                  pdfRowIndex: 1,
                  description: "SAE 30 oil 5gal",
                  qty: 4,
                  unitCost: 39.8,
                  total: 159.2,
                  kind: "inventory",
                  matchState: "auto-matched",
                  matchedProductId: "prod_oil_drum",
                  suggestions: [],
                  confidence: 0.97,
                  rawMatchHint: "alias: SAE 30 oil 5gal",
                },
                {
                  id: "line_2851_3",
                  pdfRowIndex: 2,
                  description: "Freight",
                  qty: 1,
                  unitCost: 24.0,
                  total: 24.0,
                  kind: "non-inventory",
                  matchState: "non-inventory",
                  matchedProductId: null,
                  nonInventoryCategory: "shipping",
                  expenseAccount: "5210 — Freight in",
                  suggestions: [],
                  confidence: 0.91,
                },
              ],
            });
          }
        }
      }
      return { ...state, invoices: [...state.invoices, ...next] };
    }

    case "SELECT_INVOICE":
      return { ...state, selectedInvoiceId: action.invoiceId };

    case "UPDATE_LINE":
      return mapSelected(state, (inv) => ({
        ...inv,
        lines: inv.lines.map((l) => (l.id === action.lineId ? { ...l, ...action.patch } : l)),
      }));

    case "UPDATE_DRAFT":
      return mapSelected(state, (inv) => ({
        ...inv,
        lines: inv.lines.map((l) =>
          l.id === action.lineId && l.newProductDraft
            ? { ...l, newProductDraft: { ...l.newProductDraft, ...action.patch } }
            : l,
        ),
      }));

    case "UPDATE_HEADER":
      return mapSelected(state, (inv) => ({ ...inv, ...action.patch }));

    case "CONFIRM_SUGGESTION":
      return mapSelected(state, (inv) => ({
        ...inv,
        lines: inv.lines.map((l) =>
          l.id === action.lineId
            ? {
                ...l,
                matchedProductId: action.productId,
                matchState: "auto-matched",
                aliasAdded: true,
                confidence: 0.99,
                rawMatchHint: `alias added: ${l.description}`,
              }
            : l,
        ),
      }));

    case "SET_LINE_MATCH":
      return mapSelected(state, (inv) => ({
        ...inv,
        lines: inv.lines.map((l) =>
          l.id === action.lineId
            ? {
                ...l,
                matchedProductId: action.productId,
                matchState: action.matchState,
              }
            : l,
        ),
      }));

    case "CREATE_PRODUCT": {
      const newId = `prod_new_${action.lineId}`;
      const newProduct: Product = {
        id: newId,
        sku: action.draft.sku,
        name: action.draft.name,
        category: action.draft.category,
        unit: action.draft.unit,
        lastCost: action.draft.cost,
        currentStock: 0,
        recentlyUpdated: true,
      };
      const intermediate = mapSelected(state, (inv) => ({
        ...inv,
        lines: inv.lines.map((l) =>
          l.id === action.lineId
            ? {
                ...l,
                matchedProductId: newId,
                matchState: "created",
                newProductDraft: action.draft,
                confidence: 1,
              }
            : l,
        ),
      }));
      return { ...intermediate, products: [...intermediate.products, newProduct] };
    }

    case "SET_LINE_KIND":
      return mapSelected(state, (inv) => ({
        ...inv,
        lines: inv.lines.map((l) =>
          l.id === action.lineId
            ? {
                ...l,
                kind: action.kind,
                matchState:
                  action.kind === "non-inventory"
                    ? "non-inventory"
                    : l.matchedProductId
                      ? "auto-matched"
                      : "unmatched",
                nonInventoryCategory:
                  action.kind === "non-inventory"
                    ? l.nonInventoryCategory ?? "other"
                    : undefined,
                expenseAccount:
                  action.kind === "non-inventory"
                    ? l.expenseAccount ?? "5290 — Other operating"
                    : undefined,
              }
            : l,
        ),
      }));

    case "SET_NON_INVENTORY":
      return mapSelected(state, (inv) => ({
        ...inv,
        lines: inv.lines.map((l) =>
          l.id === action.lineId
            ? {
                ...l,
                nonInventoryCategory: action.category,
                expenseAccount: action.expenseAccount,
              }
            : l,
        ),
      }));

    case "CREATE_SUPPLIER": {
      return {
        ...state,
        suppliers: [...state.suppliers, action.supplier],
        invoices: state.invoices.map((inv) =>
          inv.id === state.selectedInvoiceId
            ? { ...inv, supplierId: action.supplier.id, supplierName: action.supplier.name }
            : inv,
        ),
      };
    }

    case "COMMIT_INVOICE": {
      const inv = state.invoices.find((i) => i.id === action.invoiceId);
      if (!inv) return state;
      const productsCreated = inv.lines.filter((l) => l.matchState === "created").length;
      const productsUpdated = new Set(
        inv.lines
          .filter((l) => l.kind === "inventory" && l.matchedProductId && l.matchState !== "created")
          .map((l) => l.matchedProductId!),
      ).size;
      const aliasesAdded = inv.lines.filter((l) => l.aliasAdded).length;
      const nonInventoryPosted = inv.lines.filter((l) => l.kind === "non-inventory").length;
      const totalAmount = inv.lines.reduce((s, l) => s + lineSubtotal(l), 0);

      const updatedProductIds = new Set(
        inv.lines
          .filter((l) => l.kind === "inventory" && l.matchedProductId)
          .map((l) => l.matchedProductId!),
      );

      const products = state.products.map((p) => {
        if (!updatedProductIds.has(p.id)) return p;
        const lineForProduct = inv.lines.find((l) => l.matchedProductId === p.id);
        if (!lineForProduct) return { ...p, recentlyUpdated: true };
        return {
          ...p,
          currentStock: p.currentStock + lineForProduct.qty,
          lastCost: lineForProduct.unitCost ?? p.lastCost,
          recentlyUpdated: true,
        };
      });

      const summary: SaveSummary = {
        invoiceNumber: inv.invoiceNumber,
        supplierName: inv.supplierName,
        productsCreated,
        productsUpdated,
        aliasesAdded,
        nonInventoryPosted,
        totalAmount,
      };

      return {
        ...state,
        products,
        invoices: state.invoices.map((i) =>
          i.id === action.invoiceId ? { ...i, status: "saved" } : i,
        ),
        saveSummary: summary,
      };
    }

    case "SET_HIGHLIGHT":
      return { ...state, highlightedLineId: action.lineId };

    case "RESTART":
      return createInitialState();
  }
}

function mapSelected(
  state: DemoState,
  fn: (inv: ImportedInvoice) => ImportedInvoice,
): DemoState {
  if (!state.selectedInvoiceId) return state;
  return {
    ...state,
    invoices: state.invoices.map((inv) =>
      inv.id === state.selectedInvoiceId ? fn(inv) : inv,
    ),
  };
}

type ContextValue = {
  state: DemoState;
  dispatch: Dispatch<Action>;
  selectedInvoice: ImportedInvoice | null;
  productById: (id: string | null | undefined) => Product | undefined;
  supplierById: (id: string | null | undefined) => Supplier | undefined;
};

const DemoContext = createContext<ContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const value = useMemo<ContextValue>(() => {
    const selectedInvoice = state.invoices.find((i) => i.id === state.selectedInvoiceId) ?? null;
    const productMap = new Map(state.products.map((p) => [p.id, p]));
    const supplierMap = new Map(state.suppliers.map((s) => [s.id, s]));
    return {
      state,
      dispatch,
      selectedInvoice,
      productById: (id) => (id ? productMap.get(id) : undefined),
      supplierById: (id) => (id ? supplierMap.get(id) : undefined),
    };
  }, [state]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): ContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
