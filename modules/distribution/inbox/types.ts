// ── Inbox item types ──────────────────────────────────────────────────────

export type InboxUrgency = "blocking_others" | "today" | "this_week" | "informational";

export type InboxCategory =
  | "held_receiving"
  | "overdue_memo"
  | "expiring_lot"
  | "price_spike"
  | "new_bill"
  | "memo_acknowledged"
  | "alias_learned"
  | "quote_received";

export type PillTone = "red" | "amber" | "blue" | "green" | "gray";

export interface InboxPill {
  label: string;
  tone: PillTone;
}

export type ActionKind = "primary" | "secondary" | "ghost";

export interface InboxAction {
  label: string;
  kind: ActionKind;
  route?: string;
  handler?: string;
}

export interface InboxRelatedEntity {
  type: "bill" | "lot" | "memo" | "sku";
  id: string;
}

export interface InboxItem {
  id: string;
  urgency: InboxUrgency;
  category: InboxCategory;
  title: string;
  meta: string;
  detail?: string;
  detailTone?: "neutral" | "amber" | "red";
  pills?: InboxPill[];
  actions: InboxAction[];
  relatedEntity: InboxRelatedEntity;
  createdAt: Date;
  expiresAt?: Date;
  snoozedUntil?: Date;
}

// ── Active session types ──────────────────────────────────────────────────

export type ActiveSessionType = "receiving" | "ingestion" | "background_job";
export type ActiveSessionStatus = "in_progress" | "paused" | "failing";

export interface ActiveSession {
  id: string;
  type: ActiveSessionType;
  status: ActiveSessionStatus;
  progress: number; // 0-100
  detail: string;
  startedAt: Date;
  eta?: Date;
  blockingUser: boolean;
  relatedEntity?: { type: string; id: string };
}

// ── Inbox stat strip types ────────────────────────────────────────────────

export interface InboxStats {
  billsToReview: number;
  receivingNow: number;
  expectedToday: number;
  creditsOpenAmount: number;
  creditsOpenCount: number;
  creditsOverdue: number;
  weekSpend: number;
  weekSpendDeltaPct: number;
  priceAlerts: number;
}

// ── Expiring lot summary ──────────────────────────────────────────────────

export interface ExpiringLotEntry {
  lotId: string;
  lotNumber: string;
  productName: string;
  category: "beef" | "chicken" | "lamb" | "other";
  weightLbs: number;
  expirationDate: string; // ISO date string
  hoursRemaining: number;
}

// ── Price mover ───────────────────────────────────────────────────────────

export interface PriceMover {
  productId: string;
  productName: string;
  sku?: string;
  supplierName: string;
  deltaPct: number; // positive = up, negative = down
  sparkData: number[]; // 6-7 relative price points for sparkline
}

// ── Today's schedule ─────────────────────────────────────────────────────

export interface TodayScheduleEntry {
  id: string;
  type: "bill_due" | "order_to_ship";
  entityLabel: string; // supplier name for bills, customer name for orders
  reference: string;   // invoice number or order number
  amount: number;
  route: string;
  daysOverdue: number; // 0 = due today, positive = overdue
}

// ── Cash flow summary (Plaid) ─────────────────────────────────────────────

export interface CashFlowSummary {
  totalBalance: number;
  balanceChange7d: number;
  last7dOut: number;
  last7dIn: number;
  next7dScheduled: number;
}

// ── Re-auth banner ────────────────────────────────────────────────────────

export interface ReauthBanner {
  connectionId: string;
  institutionName: string | null;
  lastSyncAt: Date | null;
}

// ── Full inbox data ───────────────────────────────────────────────────────

export interface InboxData {
  stats: InboxStats;
  blockingItems: InboxItem[];
  actionItems: InboxItem[];
  informationalItems: InboxItem[];
  activeSessions: ActiveSession[];
  expiringLots: ExpiringLotEntry[];
  priceMovers: PriceMover[];
  /** Running total of posted supplier invoices — drives empty-state gating */
  billCount: number;
  /** Days since oldest posted invoice — drives price-alert readiness gate (unlocks at 30) */
  dayCount: number;
  /** null = no bank connected */
  cashFlow: CashFlowSummary | null;
  /** Connections requiring re-auth */
  reauthBanners: ReauthBanner[];
  /** Bills due/overdue + sales orders due today */
  todaySchedule: TodayScheduleEntry[];
}
