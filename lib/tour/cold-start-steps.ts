/**
 * Cold-start product tour step definitions. Each step targets a DOM element by
 * CSS selector (the live dashboard's stable IDs).
 */

export type TourStepPlacement = "top" | "right" | "bottom" | "left";

export type TourStepHint = {
  /** Lucide icon name or literal glyph for the hint badge. */
  icon: string;
  /** HTML allowed: <strong>, <em>, <kbd>. */
  text: string;
};

export type TourLiveStep = {
  kind: "live";
  target: string;
  placement: TourStepPlacement;
  pad?: number;
  /** "Step 1 · Welcome" */
  label: string;
  title: string;
  /** HTML allowed: <strong>, <em>, <kbd>. */
  text: string;
  hint?: TourStepHint;
};

export type TourDoneStep = {
  kind: "done";
  label: string;
  title: string;
  text: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export type TourStep = TourLiveStep | TourDoneStep;

export const coldStartTourSteps: readonly TourStep[] = [
  {
    kind: "live",
    target: "#welcomeBanner",
    placement: "bottom",
    pad: 8,
    label: "Step 1 · Welcome",
    title: "This is your day-one banner.",
    text: "Your workspace is freshly provisioned. The banner stays around until you record your first supplier bill — then it dismisses itself.",
    hint: {
      icon: "↘",
      text: "Total time: about <strong>60 seconds</strong>. Press <kbd>←</kbd> / <kbd>→</kbd> to navigate.",
    },
  },
  {
    kind: "live",
    target: "#checklist",
    placement: "right",
    pad: 6,
    label: "Step 2 · Setup checklist",
    title: "Four steps to your first invoice.",
    text: "Workspace is already provisioned — that&rsquo;s step 1 done. The other three each link to the right screen and check themselves off as you complete them.",
    hint: {
      icon: "◎",
      text: "Click any row to jump straight to the workflow. The progress bar lives on this card.",
    },
  },
  {
    kind: "live",
    target: "#kpis",
    placement: "left",
    pad: 6,
    label: "Step 3 · KPI strip",
    title: "Metrics scoped to your workspace.",
    text: "Revenue, unpaid balances, inventory value, expiring lots. All values show <strong>—</strong> or <strong>$0.00</strong> until there&rsquo;s real data — never a fake number.",
    hint: {
      icon: "§",
      text: "All financial values use tabular numerals so columns line up.",
    },
  },
  {
    kind: "live",
    target: "#recentOrders",
    placement: "top",
    pad: 6,
    label: "Step 4 · Operations panels",
    title: "Empty states that show what&rsquo;s coming.",
    text: "Each operations panel tells you what it will display once you&rsquo;ve done the relevant action. The faded sample row at the bottom previews the layout.",
    hint: {
      icon: "→",
      text: "Recent orders fills as you create sales orders; recent activity fills with every receive, fulfillment, and payment.",
    },
  },
  {
    kind: "live",
    target: "#topSearch",
    placement: "bottom",
    pad: 4,
    label: "Step 5 · Command bar",
    title: "Find anything in one keystroke.",
    text: "Search jumps to lots, orders, customers, suppliers, even individual invoice lines. It also runs commands — &ldquo;new order&rdquo;, &ldquo;record bill&rdquo;, &ldquo;invite teammate&rdquo;.",
    hint: {
      icon: "⌘",
      text: "Press <kbd>⌘</kbd> + <kbd>K</kbd> anywhere to open it.",
    },
  },
  {
    kind: "live",
    target: "#sidebar",
    placement: "right",
    pad: 4,
    label: "Step 6 · Sidebar",
    title: "Operate, Catalog, Admin.",
    text: "Three sections. Operate is the daily work — orders, inventory, invoices, payments. Catalog is your master data. Admin is users, roles, and settings.",
    hint: {
      icon: "§",
      text: "The current tenant sits at the top. Click it to switch workspaces if you belong to more than one.",
    },
  },
  {
    kind: "done",
    label: "All set",
    title: "You&rsquo;re ready.",
    text: "That&rsquo;s the dashboard. The fastest path to a non-empty workspace is <strong>Record first bill</strong> — it creates lots, customer balances, and gives the other cards something to draw.",
    primaryCta: { label: "Record first bill →", href: "/supplier-invoices/new" },
  },
] satisfies readonly TourStep[];

export const TOUR_COMPLETION_KEY = "fluxora.tour.coldStart.completedAt";

export function isTourCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(TOUR_COMPLETION_KEY));
}

export function markTourCompleted(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOUR_COMPLETION_KEY, new Date().toISOString());
}
