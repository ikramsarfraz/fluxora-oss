"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";
import { Building2, RefreshCw, Trash2, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureClientEvent } from "@/lib/posthog-client";
import { disconnectBank } from "../actions";
import type { getConnectedBanks } from "../actions";

type Bank = Awaited<ReturnType<typeof getConnectedBanks>>[number];

const C = {
  ink: "#0c0a09",
  ink2: "#44403c",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  good: "oklch(58% 0.13 155)",
  goodSoft: "oklch(96% 0.04 155)",
  warn: "oklch(70% 0.13 70)",
  warnSoft: "oklch(97% 0.04 70)",
  radius: "10px",
  mono: "'Geist Mono', ui-monospace, monospace" as const,
} as const;

function ConnectBankButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json() as { link_token?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setLinkToken(data.link_token ?? null);
    } catch {
      toast.error("Could not initialize bank connection. Check Plaid credentials.");
    } finally {
      setFetching(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (publicToken, metadata) => {
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_id: metadata.institution?.institution_id,
            institution_name: metadata.institution?.name,
          }),
        });
        const data = await res.json() as { connection_id?: string; error?: string };
        if (data.error) throw new Error(data.error);
        toast.success(`${metadata.institution?.name ?? "Bank"} connected. Syncing transactions…`);
        onSuccess();
      } catch {
        toast.error("Failed to complete bank connection.");
      }
    },
    onExit: () => setLinkToken(null),
  });

  const handleClick = useCallback(async () => {
    captureClientEvent("bank.connect_started");
    if (!linkToken) {
      await fetchLinkToken();
    } else if (ready) {
      open();
    }
  }, [linkToken, ready, open, fetchLinkToken]);

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={fetching || (!!linkToken && !ready)}
      className="h-9 bg-forest-mid px-4 text-[13px] text-white hover:bg-forest"
    >
      {fetching ? "Preparing…" : "Connect your bank"}
    </Button>
  );
}

function ReconnectButton({ connectionId, institutionName, onSuccess }: {
  connectionId: string;
  institutionName: string | null;
  onSuccess: () => void;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (publicToken, metadata) => {
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token: publicToken,
            institution_id: metadata.institution?.institution_id,
            institution_name: metadata.institution?.name,
          }),
        });
        const data = await res.json() as { error?: string };
        if (data.error) throw new Error(data.error);
        toast.success("Bank reconnected successfully.");
        onSuccess();
      } catch {
        toast.error("Failed to reconnect bank.");
      }
    },
    onExit: () => setLinkToken(null),
  });

  const handleReconnect = async () => {
    const res = await fetch("/api/plaid/link-token", { method: "POST" });
    const data = await res.json() as { link_token?: string };
    setLinkToken(data.link_token ?? null);
  };

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <Button
      type="button"
      onClick={handleReconnect}
      variant="outline"
      size="sm"
      className="h-7 border-warning-border bg-warning-bg px-3 text-[12px] text-warning-fg hover:bg-warning-bg"
    >
      Reconnect {institutionName ?? "bank"}
    </Button>
  );
}

export function BanksSettingsPage({ initialBanks }: { initialBanks: Bank[] }) {
  const [banks, setBanks] = useState(initialBanks);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const refresh = async () => {
    window.location.reload();
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    try {
      const res = await fetch(`/api/plaid/connections/${connectionId}/sync`, { method: "POST" });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? "0");
        toast.error(
          retryAfter > 0
            ? `Too many requests · try again in ${retryAfter}s`
            : "Too many requests · try again later",
        );
        return;
      }
      const data = await res.json() as { added?: number; error?: string };
      if (data.error) throw new Error(data.error);
      toast.success(`Synced. ${data.added ?? 0} new transactions.`);
    } catch {
      toast.error("Sync failed.");
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm("Disconnect this bank? Transaction history is preserved, but new syncs will stop.")) return;
    setDisconnecting(connectionId);
    try {
      await disconnectBank(connectionId);
      setBanks(prev => prev.filter(b => b.id !== connectionId));
      toast.success("Bank disconnected.");
    } catch {
      toast.error("Failed to disconnect.");
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div style={{ fontFamily: "'Geist', system-ui, sans-serif", color: C.ink, lineHeight: "1.5", maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Bank connections</h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
            Read-only · powered by Plaid · we never move money
          </p>
        </div>
        <ConnectBankButton onSuccess={refresh} />
      </div>

      {banks.length === 0 ? (
        <EmptyState onConnect={refresh} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {banks.map(bank => (
            <BankCard
              key={bank.id}
              bank={bank}
              syncing={syncing === bank.id}
              disconnecting={disconnecting === bank.id}
              onSync={() => handleSync(bank.id)}
              onDisconnect={() => handleDisconnect(bank.id)}
              onReconnect={refresh}
            />
          ))}
        </div>
      )}

      <PrivacyNote />
    </div>
  );
}

function BankCard({
  bank,
  syncing,
  disconnecting,
  onSync,
  onDisconnect,
  onReconnect,
}: {
  bank: Bank;
  syncing: boolean;
  disconnecting: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const needsReauth = bank.status === "requires_reauth";
  const lastSync = bank.lastSyncAt
    ? new Date(bank.lastSyncAt).toLocaleString()
    : "Never synced";

  return (
    <div
      style={{
        border: `1px solid ${needsReauth ? C.warn : C.line}`,
        borderRadius: C.radius,
        padding: "16px 20px",
        background: needsReauth ? C.warnSoft : C.surface,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: C.line2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Building2 size={16} color={C.ink2} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {bank.institutionName ?? "Unknown institution"}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {bank.accountCount} account{bank.accountCount !== 1 ? "s" : ""} · Last sync: {lastSync}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {needsReauth ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.warn }}>
                <AlertTriangle size={13} />
                Needs re-authentication
              </div>
              <ReconnectButton
                connectionId={bank.id}
                institutionName={bank.institutionName}
                onSuccess={onReconnect}
              />
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.good }}>
                <Wifi size={13} />
                Active
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={syncing}
                className="h-7 px-3 text-[12px]"
              >
                <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDisconnect}
            disabled={disconnecting}
            className="size-7 text-subtle hover:text-danger-fg"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {bank.accounts.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {bank.accounts.map(a => (
            <div
              key={a.id}
              style={{
                fontSize: 12,
                background: C.line2,
                borderRadius: 6,
                padding: "4px 10px",
                color: C.ink2,
              }}
            >
              {a.name}
              {a.mask ? ` ···${a.mask}` : ""}
              {a.currentBalance != null
                ? ` · $${a.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.line}`,
        borderRadius: C.radius,
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <WifiOff size={32} color={C.line} style={{ margin: "0 auto 16px" }} />
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No banks connected</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        Connect your bank to auto-match payments to bills.
        <br />
        Read-only access · we never see your password or move money.
      </div>
      <ConnectBankButton onSuccess={onConnect} />
    </div>
  );
}

function PrivacyNote() {
  return (
    <div
      style={{
        marginTop: 32,
        padding: "16px 20px",
        background: C.line2,
        borderRadius: C.radius,
        fontSize: 12,
        color: C.muted,
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: C.ink2 }}>Privacy & security</strong> — Bank connections are read-only via Plaid.
      We store an encrypted access token to retrieve transactions; we never see your login credentials or have
      the ability to initiate transfers. Connections may expire every 30–90 days and require brief re-authentication.
      Disconnecting removes active sync but preserves your transaction history for audit purposes.
    </div>
  );
}
