"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  confirmPaymentMatch,
  dismissMysteryOutflowsBulkAction,
  rejectPaymentMatch,
  syncAllConnectionsAction,
} from "../actions";
import { LinkToBillSheet } from "./link-to-bill-sheet";
import type { getBankActivity } from "../services/bank-activity";

type Data = Awaited<ReturnType<typeof getBankActivity>>;
type Transaction = Data["transactions"][number];

const C = {
  ink: "var(--color-ink)",
  ink2: "var(--color-ink-warm)",
  muted: "var(--color-subtle)",
  surface: "var(--color-card)",
  line: "var(--color-border-default)",
  line2: "var(--color-divider)",
  good: "var(--color-success-fg)",
  goodSoft: "var(--color-success-bg)",
  warn: "var(--color-warning-fg)",
  warnSoft: "var(--color-warning-bg)",
  info: "var(--color-info-fg)",
  infoSoft: "var(--color-info-bg)",
  radius: "10px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

type Filter = "all" | "matched" | "pending_review" | "unmatched" | "pending" | "mystery";

const FILTER_VALUES: Filter[] = ["all", "matched", "pending_review", "unmatched", "pending", "mystery"];

function parseFilter(raw: string | null): Filter {
  return (FILTER_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as Filter)
    : "all";
}

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const SORT_VALUES: SortKey[] = ["date-desc", "date-asc", "amount-desc", "amount-asc"];

function parseSortKey(raw: string | null): SortKey {
  return (SORT_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as SortKey)
    : "date-desc";
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Date (newest first)" },
  { value: "date-asc", label: "Date (oldest first)" },
  { value: "amount-desc", label: "Amount (largest first)" },
  { value: "amount-asc", label: "Amount (smallest first)" },
];

function sortTransactions(rows: Transaction[], key: SortKey): Transaction[] {
  // Sort by absolute amount so a +$500 inflow and a -$500 outflow rank
  // together when filtering by magnitude, which matches what users mean
  // when they say "biggest transactions".
  const sorted = [...rows];
  switch (key) {
    case "date-desc":
      return sorted.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    case "date-asc":
      return sorted.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
    case "amount-desc":
      return sorted.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    case "amount-asc":
      return sorted.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
  }
}

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function BankActivityShell({ data }: { data: Data }) {
  const searchParams = useSearchParams();
  // Initial state is seeded from URL once at mount; subsequent updates go
  // through setters that also rewrite the URL via History.replaceState
  // (one-way; we don't re-listen for popstate because the page is a server
  // component and a back/forward will re-render with the new params anyway).
  const [filter, setFilterState] = useState<Filter>(() => parseFilter(searchParams.get("filter")));
  const [searchText, setSearchText] = useState(() => searchParams.get("q") ?? "");
  const [accountFilter, setAccountFilterState] = useState<string | null>(() => searchParams.get("account") || null);
  const [sortKey, setSortKeyState] = useState<SortKey>(() => parseSortKey(searchParams.get("sort")));
  const [page, setPageState] = useState<number>(() =>
    parsePositiveInt(searchParams.get("page"), 1),
  );
  const [pageSize, setPageSizeState] = useState<number>(() =>
    parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMysteryIds, setSelectedMysteryIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [dismissingBulk, startBulkDismiss] = useTransition();

  const writeUrlParams = useCallback(
    (updates: Record<string, { value: string | null; default: string }>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, { value, default: dflt }] of Object.entries(updates)) {
        if (!value || value === dflt) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, "", next);
    },
    [],
  );

  const writeUrlParam = useCallback(
    (key: string, value: string | null, defaultValue: string) =>
      writeUrlParams({ [key]: { value, default: defaultValue } }),
    [writeUrlParams],
  );

  // Selection is only meaningful inside the Mystery view; reset whenever the
  // user changes filter so a stale selection can't accidentally batch-dismiss
  // rows the user can no longer see. Filter/search/sort/account changes also
  // reset to page 1 so the user doesn't land on an out-of-range page.
  function changeFilter(next: Filter) {
    if (next !== filter) setSelectedMysteryIds(new Set());
    setFilterState(next);
    setPageState(1);
    writeUrlParams({
      filter: { value: next, default: "all" },
      page: { value: null, default: "1" },
    });
  }

  function setAccountFilter(next: string | null) {
    setAccountFilterState(next);
    setPageState(1);
    writeUrlParams({
      account: { value: next, default: "" },
      page: { value: null, default: "1" },
    });
  }

  function setSortKey(next: SortKey) {
    setSortKeyState(next);
    setPageState(1);
    writeUrlParams({
      sort: { value: next, default: "date-desc" },
      page: { value: null, default: "1" },
    });
  }

  function setPage(next: number) {
    setPageState(next);
    writeUrlParam("page", next === 1 ? null : String(next), "1");
  }

  function setPageSize(next: number) {
    setPageSizeState(next);
    setPageState(1);
    writeUrlParams({
      pageSize: { value: String(next), default: String(DEFAULT_PAGE_SIZE) },
      page: { value: null, default: "1" },
    });
  }

  function toggleMysterySelection(txnId: string) {
    setSelectedMysteryIds(prev => {
      const next = new Set(prev);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  }

  const handleSync = () => {
    startSync(async () => {
      try {
        const result = await syncAllConnectionsAction();
        if (result.synced === 0 && result.failed === 0) {
          toast.info("No active bank connections to sync.");
        } else if (result.failed > 0) {
          toast.warning(
            `Synced ${result.synced} bank${result.synced === 1 ? "" : "s"}, ${result.failed} failed. Check connection status.`,
          );
        } else {
          const totalChanges = result.totalAdded + result.totalModified + result.totalRemoved;
          toast.success(
            totalChanges > 0
              ? `Synced ${result.synced} bank${result.synced === 1 ? "" : "s"}: ${result.totalAdded} new, ${result.totalModified} updated.`
              : `Synced ${result.synced} bank${result.synced === 1 ? "" : "s"}. No new transactions.`,
          );
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Sync failed.");
      }
    });
  };

  // Re-auth banner: dedupe by institutionName so two accounts at the same
  // bank don't render two banners.
  const needsReauthInstitutions = Array.from(
    new Map(
      data.accounts
        .filter(a => a.connectionStatus === "requires_reauth")
        .map(a => [a.institutionName ?? "Bank", a]),
    ).values(),
  );

  const accountFiltered = accountFilter
    ? data.transactions.filter(t => t.accountId === accountFilter)
    : data.transactions;

  const stateFiltered = filter === "all"
    ? accountFiltered
    : filter === "pending"
      ? accountFiltered.filter(t => t.pending)
      : filter === "mystery"
        ? accountFiltered.filter(t => t.isMysteryOutflow && !t.pending)
        : accountFiltered.filter(t => t.state === filter);

  const q = searchText.trim().toLowerCase();
  const searched = q === ""
    ? stateFiltered
    : stateFiltered.filter(t => {
        const merchant = (t.merchantName ?? "").toLowerCase();
        const desc = (t.rawDescription ?? "").toLowerCase();
        const invoiceNum = (t.match?.invoice.invoiceNumber ?? "").toLowerCase();
        return merchant.includes(q) || desc.includes(q) || invoiceNum.includes(q);
      });

  const visible = sortKey === "date-desc" ? searched : sortTransactions(searched, sortKey);

  // Client-side pagination. Total/pageCount reflect the post-filter+search
  // result; if a filter change leaves the current page out of range, clamp
  // to a safe value so the user lands on real data instead of an empty list.
  const total = visible.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, safePage * pageSize);

  const lastSync = data.lastSyncAt
    ? timeSince(new Date(data.lastSyncAt))
    : "never";

  const totalBalance = data.accounts.reduce((s, a) => s + a.currentBalance, 0);
  const noConnections = data.accounts.length === 0;

  if (noConnections) {
    return (
      <div className="text-ink">
        <div className="mb-6 flex items-start justify-between">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight">Bank activity</h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-default bg-card px-8 py-12 text-center">
          <div className="text-base font-semibold text-ink">
            Connect your bank to get started
          </div>
          <div className="max-w-md text-[13px] text-subtle">
            Once linked, we&apos;ll sync 90 days of transactions and start
            matching outflows against your open bills automatically.
          </div>
          <Link href="/settings/integrations/banks">
            <Button size="sm" className="h-9 px-4 text-[13px]">
              Connect a bank
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-ink">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight">Bank activity</h1>
          <div className="mt-1 text-xs text-subtle">Synced {lastSync}</div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="h-8 px-3 text-[13px]"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
          <Link href="/settings/integrations/banks">
            <Button variant="outline" size="sm" className="h-8 px-3 text-[13px]">
              Manage banks
            </Button>
          </Link>
        </div>
      </div>

      {/* Re-auth banner — warning-tone alert card */}
      {needsReauthInstitutions.length > 0 && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-warning-border bg-warning-bg px-4 py-3">
          <div className="text-[13px] leading-relaxed text-ink-warm">
            <strong className="text-warning-fg">Reconnect required:</strong>{" "}
            {needsReauthInstitutions.map(a => a.institutionName ?? "Bank").join(", ")}
            {" — "}new transactions won&apos;t sync until you sign in again.
          </div>
          <Link href="/settings/integrations/banks">
            <Button size="sm" className="h-8 px-3 text-[13px]">
              Reconnect
            </Button>
          </Link>
        </div>
      )}

      {/* Accounts strip — tiles are click-to-filter */}
      <div className="mb-6 flex gap-2.5 overflow-x-auto pb-1">
        {/* Total cash card — also clears the account filter. Stays dark for
            intentional contrast against the tenant's accounts; selected
            state is a token-driven ring. */}
        <button
          type="button"
          onClick={() => setAccountFilter(null)}
          aria-pressed={accountFilter === null}
          title={accountFilter ? "Clear account filter" : undefined}
          className={`flex shrink-0 min-w-[160px] flex-col rounded-lg bg-ink px-4.5 py-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
            accountFilter === null ? "ring-2 ring-success-fg" : ""
          }`}
        >
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
            Total cash
          </div>
          <div className="font-mono text-[22px] font-bold tabular-nums text-card">
            ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-subtle">
            {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""}
          </div>
        </button>

        {data.accounts.map(account => {
          const health = accountHealth(account.connectionStatus, account.lastSyncAt);
          const active = accountFilter === account.id;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => setAccountFilter(active ? null : account.id)}
              aria-pressed={active}
              title={active ? "Click to clear filter" : "Click to filter to this account"}
              className={`flex shrink-0 min-w-[150px] flex-col rounded-lg border bg-card px-4.5 py-3.5 text-left transition hover:border-border-default focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                active
                  ? "border-success-fg ring-2 ring-success-fg"
                  : "border-border-soft"
              }`}
            >
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-subtle">
                <span
                  aria-hidden
                  title={health.tooltip}
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: health.color }}
                />
                <span className="truncate">{account.institutionName ?? "Bank"}</span>
              </div>
              <div className="font-mono text-[15px] font-semibold tabular-nums text-ink">
                ${account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-0.5 text-[11px] text-subtle">
                {account.name}
                {account.mask ? ` ···${account.mask}` : ""}
              </div>
            </button>
          );
        })}

        <Link href="/settings/integrations/banks" className="no-underline">
          <div className="flex h-full shrink-0 min-w-[120px] items-center justify-center rounded-lg border border-dashed border-border-default bg-card px-4.5 py-3.5 text-[13px] text-subtle hover:text-ink">
            + Add another
          </div>
        </Link>
      </div>

      {/* Filter tabs (ToggleGroup, matches ListingPage status segments) + sort + search */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={value => {
            if (value) changeFilter(value as Filter);
            setPageState(1);
          }}
          spacing={1}
          variant="default"
          size="sm"
          className="rounded-md bg-divider p-0.5"
        >
          {(
            [
              { key: "all", label: "All", count: data.transactions.length },
              { key: "matched", label: "Matched", count: data.counts.matched },
              { key: "pending_review", label: "Pending review", count: data.counts.pending_review },
              { key: "unmatched", label: "Unmatched", count: data.counts.unmatched },
              { key: "pending", label: "Pending settlement", count: data.counts.pending },
              { key: "mystery", label: "Mystery", count: data.counts.mystery },
            ] as const
          ).map(({ key, label, count }) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="h-7 gap-1.5 rounded px-2.5 text-xs font-normal text-subtle shadow-none hover:bg-transparent hover:text-ink data-[state=on]:border data-[state=on]:border-border-default data-[state=on]:bg-card data-[state=on]:font-medium data-[state=on]:text-ink data-[state=on]:shadow-xs"
            >
              {label}
              <span className="rounded-full bg-divider/80 px-1.5 py-0.5 text-[10px] tabular-nums text-subtle group-data-[state=on]:bg-divider">
                {count}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <Select
            value={sortKey}
            onValueChange={value => setSortKey(value as SortKey)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Sort transactions"
              className="h-8 w-[200px] border-border-default bg-card text-[13px] text-ink-warm shadow-none"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="search"
            value={searchText}
            onChange={e => {
              const next = e.target.value;
              setSearchText(next);
              setPageState(1);
              writeUrlParams({
                q: { value: next, default: "" },
                page: { value: null, default: "1" },
              });
            }}
            placeholder="Search merchant, description, invoice…"
            aria-label="Filter transactions"
            className="h-8 w-[280px] border-border-default bg-card text-[13px] shadow-none"
          />
        </div>
      </div>

      {/* Bulk-select bar — Mystery view only. Surfaces select-all + dismiss
          batch CTA when ≥1 row is checked on the current page. */}
      {filter === "mystery" && paged.length > 0 && (
        <BulkMysteryBar
          visibleIds={paged.map(t => t.id)}
          selectedIds={selectedMysteryIds}
          onToggleAll={(allSelected) => {
            setSelectedMysteryIds(
              allSelected ? new Set() : new Set(paged.map(t => t.id)),
            );
          }}
          onDismiss={() => {
            const ids = Array.from(selectedMysteryIds);
            startBulkDismiss(async () => {
              try {
                const result = await dismissMysteryOutflowsBulkAction(ids);
                toast.success(
                  `Dismissed ${result.dismissed} mystery outflow${result.dismissed === 1 ? "" : "s"}.`,
                );
                setSelectedMysteryIds(new Set());
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Bulk dismiss failed.");
              }
            });
          }}
          pending={dismissingBulk}
        />
      )}

      {/* Transaction list + pagination footer, wrapped in a single card so the
          footer hangs off the list visually. Matches the ListingPage shape. */}
      {paged.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-default bg-card px-6 py-10 text-center text-[13px] text-subtle">
          {q !== ""
            ? `No transactions match "${searchText}".`
            : "No transactions in this view."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-soft bg-card">
          <div>
            {paged.map((txn, i) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                isLast={i === paged.length - 1}
                expanded={expandedId === txn.id}
                onToggle={() => setExpandedId(expandedId === txn.id ? null : txn.id)}
                selectable={filter === "mystery"}
                selected={selectedMysteryIds.has(txn.id)}
                onSelectionToggle={() => toggleMysterySelection(txn.id)}
              />
            ))}
          </div>

          {/* Pagination footer — mirrors ListingPage's footer for visual parity */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-subtle">
              <span>Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={value => setPageSize(Number(value))}
              >
                <SelectTrigger
                  size="sm"
                  className="h-7 w-[72px] border-border-default bg-card px-2 text-xs text-ink-warm shadow-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-subtle tabular-nums">
              {total > 0 ? `${rangeStart}-${rangeEnd} of ${total.toLocaleString()}` : "0 records"}
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Previous"
                disabled={safePage <= 1}
                className="size-7 border-border-default bg-card text-ink-warm shadow-none disabled:bg-divider"
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-1.5 text-xs tabular-nums text-subtle">
                {safePage} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Next"
                disabled={safePage >= pageCount}
                className="size-7 border-border-default bg-card text-ink-warm shadow-none disabled:bg-divider"
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkMysteryBar({
  visibleIds,
  selectedIds,
  onToggleAll,
  onDismiss,
  pending,
}: {
  visibleIds: string[];
  selectedIds: Set<string>;
  onToggleAll: (allSelected: boolean) => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  const visibleSelectedCount = visibleIds.filter(id => selectedIds.has(id)).length;
  const allSelected = visibleSelectedCount === visibleIds.length && visibleIds.length > 0;
  const hasSelection = selectedIds.size > 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        marginBottom: 8,
        border: `1px solid ${C.line}`,
        borderRadius: C.radius,
        background: C.surface,
        fontSize: 13,
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={allSelected}
          ref={el => {
            // Indeterminate when *some* but not all visible rows are selected.
            if (el) el.indeterminate = visibleSelectedCount > 0 && !allSelected;
          }}
          onChange={() => onToggleAll(allSelected)}
        />
        <span style={{ color: C.ink2 }}>
          {hasSelection ? `${selectedIds.size} selected` : "Select all"}
        </span>
      </label>
      <span style={{ marginLeft: "auto" }}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDismiss}
          disabled={!hasSelection || pending}
          className="h-8 px-3 text-[13px]"
        >
          {pending
            ? "Dismissing…"
            : hasSelection
              ? `Dismiss ${selectedIds.size}`
              : "Dismiss selected"}
        </Button>
      </span>
    </div>
  );
}

function TransactionRow({
  txn,
  isLast,
  expanded,
  onToggle,
  selectable,
  selected,
  onSelectionToggle,
}: {
  txn: Transaction;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
  selectable: boolean;
  selected: boolean;
  onSelectionToggle: () => void;
}) {
  const [confirming, startConfirm] = useTransition();
  const [rejecting, startReject] = useTransition();
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const router = useRouter();

  const isOutflow = txn.amount > 0;
  const amountStr = `${isOutflow ? "-" : "+"}$${Math.abs(txn.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const isPendingReview = txn.state === "pending_review" && txn.match;
  const isUnmatched = txn.state === "unmatched" && isOutflow && !txn.pending;

  const handleConfirm = () => {
    if (!txn.match) return;
    startConfirm(async () => {
      try {
        await confirmPaymentMatch(txn.match!.id);
        toast.success("Match confirmed. Bill marked as paid.");
        router.refresh();
      } catch {
        toast.error("Failed to confirm match.");
      }
    });
  };

  const handleReject = () => {
    if (!txn.match) return;
    startReject(async () => {
      try {
        await rejectPaymentMatch(txn.match!.id);
        toast.success("Match dismissed.");
        router.refresh();
      } catch {
        toast.error("Failed to dismiss match.");
      }
    });
  };

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selectable
            ? "28px 28px 1fr auto auto auto"
            : "28px 1fr auto auto auto",
          gap: 12,
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: isLast && !expanded ? "none" : `1px solid ${C.line2}`,
          background: selected ? "var(--color-warning-bg)" : (expanded ? "var(--color-page)" : C.surface),
          cursor: isPendingReview ? "pointer" : undefined,
        }}
        onClick={isPendingReview ? onToggle : undefined}
      >
        {/* Bulk-select checkbox — Mystery view only */}
        {selectable && (
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelectionToggle}
              aria-label={`Select ${txn.merchantName ?? "transaction"} for bulk action`}
            />
          </div>
        )}

        {/* Status icon */}
        <StateIcon state={txn.state} pending={txn.pending} />

        {/* Payee + meta */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {txn.merchantName ?? txn.rawDescription.substring(0, 40)}
            </span>
            {txn.pending && (
              <span style={{ fontSize: 11, color: C.muted, background: C.line2, padding: "1px 6px", borderRadius: 100 }}>
                Pending settlement
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span>{txn.rawDescription.substring(0, 40)}{txn.rawDescription.length > 40 ? "…" : ""}</span>
            <span>·</span>
            <span>{txn.accountName}{txn.accountMask ? ` ···${txn.accountMask}` : ""}</span>
            <span>·</span>
            <span style={{ fontWeight: 600, textTransform: "uppercase" }}>{txn.paymentMethod}</span>
            {txn.isMysteryOutflow && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-danger-fg)", background: "var(--color-danger-bg)", padding: "1px 5px", borderRadius: 4 }}>
                Mystery
              </span>
            )}
            {txn.transferPairId && (
              <span
                title="Internal transfer between two of your accounts"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--color-info-fg)",
                  background: "var(--color-info-bg)",
                  padding: "1px 5px",
                  borderRadius: 4,
                }}
              >
                Transfer
              </span>
            )}
          </div>
        </div>

        {/* Match reference / channel note */}
        <div style={{ textAlign: "right", minWidth: 140 }}>
          {txn.match ? (
            <div>
              <Link
                href={`/supplier-invoices/${txn.match.invoice.id}`}
                style={{ fontSize: 12, color: C.info, textDecoration: "none", fontFamily: C.mono }}
                onClick={e => e.stopPropagation()}
              >
                {txn.match.invoice.invoiceNumber}
              </Link>
              <div style={{ fontSize: 11, marginTop: 1 }}>
                <ConfidenceBadge
                  confidence={txn.match.confidence}
                  autoApplied={txn.match.autoApplied}
                  paymentMethod={txn.paymentMethod}
                />
              </div>
            </div>
          ) : isUnmatched ? (
            <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
              {txn.paymentMethod === "check"
                ? "Banks don't include payee info on check transactions."
                : txn.paymentMethod === "zelle"
                  ? "No payee in Zelle record."
                  : "No match found."}
            </span>
          ) : (
            <span style={{ fontSize: 12, color: C.muted }}>—</span>
          )}
        </div>

        {/* Amount */}
        <div
          style={{
            fontFamily: C.mono,
            fontSize: 13,
            fontWeight: 600,
            color: isOutflow ? C.ink : C.good,
            whiteSpace: "nowrap",
          }}
        >
          {amountStr}
        </div>

        {/* Action */}
        <div style={{ minWidth: 96, textAlign: "right" }} onClick={e => e.stopPropagation()}>
          {isPendingReview ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: C.warn }}>
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: C.warn,
                  border: `1px solid ${C.warn}`,
                  borderRadius: 100,
                  padding: "2px 8px",
                  fontWeight: 500,
                }}
              >
                Review
              </span>
            </div>
          ) : txn.match ? (
            <Link href={`/supplier-invoices/${txn.match.invoice.id}`}>
              <span style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 3 }}>
                <ExternalLink size={11} />
                View
              </span>
            </Link>
          ) : isUnmatched ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setLinkSheetOpen(true)}
              className="h-7 px-3 text-xs"
            >
              Link to bill
            </Button>
          ) : (
            <span style={{ fontSize: 12, color: C.muted }}>—</span>
          )}
        </div>
      </div>

      {/* Expanded match detail */}
      {expanded && txn.match && (
        <MatchDetailBlock
          txn={txn}
          onConfirm={handleConfirm}
          onReject={handleReject}
          confirming={confirming}
          rejecting={rejecting}
        />
      )}

      {/* Link-to-bill sheet */}
      <LinkToBillSheet
        txn={txn}
        open={linkSheetOpen}
        onClose={() => setLinkSheetOpen(false)}
      />
    </>
  );
}

function MatchDetailBlock({
  txn,
  onConfirm,
  onReject,
  confirming,
  rejecting,
}: {
  txn: Transaction;
  onConfirm: () => void;
  onReject: () => void;
  confirming: boolean;
  rejecting: boolean;
}) {
  const match = txn.match!;
  const factors = [
    {
      label: "Amount",
      score: match.amountScore,
      detail: match.amountScore >= 0.99 ? "Exact match" : match.amountScore >= 0.9 ? "Near match (fees)" : "Approximate",
      icon: match.amountScore >= 0.9 ? "✓" : "⚠",
      good: match.amountScore >= 0.9,
    },
    {
      label: "Payee",
      score: match.payeeScore,
      detail: match.payeeScore >= 0.95 ? "Known alias" : match.payeeScore >= 0.8 ? "Likely match" : "Fuzzy match",
      icon: match.payeeScore >= 0.8 ? "✓" : "⚠",
      good: match.payeeScore >= 0.8,
    },
    {
      label: "Timing",
      score: match.timingScore,
      detail: match.timingScore >= 0.95
        ? "On due date"
        : match.timingScore >= 0.6
          ? "Within 30 days"
          : "Late payment",
      icon: match.timingScore >= 0.6 ? "✓" : "⚠",
      good: match.timingScore >= 0.6,
    },
  ];

  return (
    <div
      style={{
        background: C.warnSoft,
        borderBottom: `1px solid ${C.line}`,
        padding: "16px 20px 20px",
      }}
    >
      {/* Factor grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        {factors.map(f => (
          <div
            key={f.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {f.label}
              </span>
              <span style={{ fontSize: 13, color: f.good ? C.good : C.warn }}>
                {f.icon}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{f.detail}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              Score: {(f.score * 100).toFixed(0)}%
            </div>
          </div>
        ))}
      </div>

      {/* Copy */}
      <div
        style={{
          fontSize: 12,
          color: C.ink2,
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        Confirming will mark <strong>{match.invoice.invoiceNumber}</strong> as paid
        {match.invoice.supplierName
          ? ` and remember "${txn.rawDescription.substring(0, 30)}${txn.rawDescription.length > 30 ? "…" : ""}" as an alias for ${match.invoice.supplierName} — next time we'll auto-apply.`
          : "."}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          type="button"
          size="sm"
          onClick={onConfirm}
          disabled={confirming}
          className="h-8 bg-forest-mid px-4 text-[13px] text-white hover:bg-forest"
        >
          {confirming ? "Confirming…" : "Confirm match"}
        </Button>
        <Link href={`/supplier-invoices/${match.invoice.id}`}>
          <Button variant="outline" size="sm" className="h-8 px-3 text-[13px]">
            Link to different bill
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReject}
          disabled={rejecting}
          className="h-8 px-3 text-[13px] text-subtle"
        >
          {rejecting ? "…" : "Not a bill payment"}
        </Button>
      </div>
    </div>
  );
}

function StateIcon({ state, pending }: { state: string; pending: boolean }) {
  if (pending) {
    return (
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #a8a29e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-muted)" }} />
      </div>
    );
  }
  if (state === "matched") {
    return (
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.good, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2.5 2.5 4-4" stroke="var(--color-card)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (state === "pending_review") {
    return (
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.warn, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--color-card)", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>?</span>
      </div>
    );
  }
  return (
    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.line }} />
    </div>
  );
}

function ConfidenceBadge({ confidence, autoApplied, paymentMethod }: { confidence: number; autoApplied: boolean; paymentMethod?: string }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.95 ? C.good : confidence >= 0.6 ? C.warn : C.muted;
  const noPayeeLabel = paymentMethod === "check"
    ? " · no payee"
    : paymentMethod === "zelle"
      ? " · amount only"
      : "";
  return (
    <span style={{ fontSize: 11, color, fontWeight: 500 }}>
      {pct}%{noPayeeLabel} · {autoApplied ? "auto-applied" : "needs review"}
    </span>
  );
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function accountHealth(
  connectionStatus: string,
  lastSyncAt: Date | null,
): { color: string; tooltip: string } {
  if (connectionStatus === "requires_reauth") {
    return { color: "var(--color-danger-fg)", tooltip: "Reconnect required" };
  }
  if (!lastSyncAt) {
    return { color: "var(--color-warning-fg)", tooltip: "Never synced" };
  }
  const hoursOld = (Date.now() - lastSyncAt.getTime()) / 3_600_000;
  if (hoursOld <= 24) {
    return { color: "var(--color-success-fg)", tooltip: `Synced ${timeSince(lastSyncAt)}` };
  }
  return { color: "var(--color-warning-fg)", tooltip: `Synced ${timeSince(lastSyncAt)} — stale` };
}
