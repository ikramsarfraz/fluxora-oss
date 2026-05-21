"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSupplierInvoice, useCompleteSupplierInvoice } from "../hooks/use-supplier-invoices";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";

// ── Design tokens ────────────────────────────────────────────────────────────
const c = {
  bg: "var(--color-surface)",
  card: "var(--color-card)",
  border: "var(--color-border-default)",
  borderStrong: "var(--color-border-default)",
  text: "var(--color-ink)",
  text2: "var(--color-subtle)",
  text3: "var(--color-muted)",
  accent: "var(--color-ink)",
  green: "var(--color-success-fg)",
  greenBg: "var(--color-success-bg)",
  greenBorder: "var(--color-success-border)",
  amber: "var(--color-warning-fg)",
  amberBg: "var(--color-warning-bg)",
  amberBorder: "var(--color-warning-border)",
  red: "var(--color-danger-fg)",
  redBg: "var(--color-danger-bg)",
  redBorder: "var(--color-danger-border)",
  blue: "var(--color-forest-mid)",
  blueBg: "#eff6ff",
  blueBorder: "#bfdbfe",
  mono: "var(--font-mono, ui-monospace, monospace)",
} as const;

type DiscrepancyReason = "short" | "underweight" | "damaged" | "wrong_item" | "temp_fail" | "expired";

type LineState = {
  status: "pending" | "ok" | "flagged";
  discrepancy?: DiscrepancyReason;
  note: string;
  photos: string[]; // data URLs
  voiceNote: string | null; // blob URL
};

type Step = "checkin" | "walking" | "flagging" | "signoff";

// ── Signature canvas ──────────────────────────────────────────────────────────
function SignatureCanvas({
  onSign,
  value,
}: {
  onSign: (dataUrl: string | null) => void;
  value: string | null;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = React.useState(false);
  const lastPos = React.useRef<{ x: number; y: number } | null>(null);

  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const rect = canvasRef.current!.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0]!;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function onStart(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  }

  function onMove(e: React.TouchEvent | React.MouseEvent) {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = c.text;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  }

  function onEnd(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault();
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) onSign(canvas.toDataURL());
  }

  function clearSig() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSign(null);
  }

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={240}
        height={80}
        style={{
          width: "100%", height: 80,
          border: value ? `2px solid ${c.greenBorder}` : `2px dashed ${c.borderStrong}`,
          borderRadius: 10, background: value ? c.greenBg : "var(--color-page)",
          touchAction: "none", cursor: "crosshair",
        }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      />
      {!value && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          pointerEvents: "none", fontSize: 12, color: c.text3, fontStyle: "italic",
        }}>Sign with your finger →</div>
      )}
      {value && (
        <button onClick={clearSig} style={{
          position: "absolute", top: 6, right: 8,
          background: "none", border: "none", fontSize: 11,
          color: c.text3, cursor: "pointer", fontFamily: "inherit",
        }}>Clear</button>
      )}
    </div>
  );
}

// ── NumStepper ────────────────────────────────────────────────────────────────
function NumStepper({
  value, min, max, step = 1, unit, onChange,
}: {
  value: number; min?: number; max?: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  const decrement = () => onChange(Math.max(min ?? 0, value - step));
  const increment = () => onChange(max !== undefined ? Math.min(max, value + step) : value + step);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button onClick={decrement} style={{
        width: 34, height: 34, borderRadius: 9,
        background: c.card, border: `1.5px solid ${c.borderStrong}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 700, color: c.text, cursor: "pointer", flexShrink: 0,
      }}>−</button>
      <div style={{ minWidth: 60, textAlign: "center", fontFamily: c.mono, fontSize: 18, fontWeight: 700 }}>
        {value}
        {unit && <span style={{ fontSize: 11, color: c.text3, fontWeight: 600 }}>{unit}</span>}
      </div>
      <button onClick={increment} style={{
        width: 34, height: 34, borderRadius: 9,
        background: c.card, border: `1.5px solid ${c.borderStrong}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 700, color: c.text, cursor: "pointer", flexShrink: 0,
      }}>+</button>
    </div>
  );
}

// ── Offline banner ────────────────────────────────────────────────────────────
function OfflineBanner() {
  const [offline, setOffline] = React.useState(false);
  React.useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{
      position: "fixed", top: 56, left: 12, right: 12, zIndex: 100,
      background: c.text, color: "var(--color-card)", borderRadius: 10, padding: "8px 12px",
      fontSize: 11.5, display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.amber, flexShrink: 0 }} />
      <span><strong>Offline</strong> · actions queued and will sync when wifi returns</span>
    </div>
  );
}

// ── Progress strip ────────────────────────────────────────────────────────────
function MobileProgressStrip({ ok, flagged, total }: { ok: number; flagged: number; total: number }) {
  if (total === 0) return null;
  return (
    <div style={{ height: 6, background: "var(--color-divider)", display: "flex", overflow: "hidden" }}>
      {ok > 0 && <div style={{ width: `${(ok / total) * 100}%`, background: c.green, transition: "width .3s" }} />}
      {flagged > 0 && <div style={{ width: `${(flagged / total) * 100}%`, background: c.amber, transition: "width .3s" }} />}
    </div>
  );
}

// ── Main mobile flow ──────────────────────────────────────────────────────────
export function MobileReceiveFlow({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const { data: invoice, isLoading } = useSupplierInvoice(invoiceId);
  const completeMutation = useCompleteSupplierInvoice();

  const [step, setStep] = React.useState<Step>("checkin");
  const [currentLineIdx, setCurrentLineIdx] = React.useState(0);
  const [lineStates, setLineStates] = React.useState<Record<string, LineState>>({});
  const [flaggingLineId, setFlaggingLineId] = React.useState<string | null>(null);
  const [receiverSig, setReceiverSig] = React.useState<string | null>(null);
  const [startedAt] = React.useState(Date.now());
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = React.useState(false);
  const chunksRef = React.useRef<BlobEvent["data"][]>([]);

  if (isLoading || !invoice) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: c.bg }}>
        <div style={{ fontSize: 14, color: c.text3 }}>Loading…</div>
      </div>
    );
  }

  const lines = invoice.lines.map(line => ({
    id: line.id,
    productName: line.product?.name ?? "Unknown",
    sku: line.product?.sku ?? "",
    quantityCases: line.quantityCases ?? 0,
    weightLbs: Number(line.weightLbs ?? 0),
    unitPrice: Number(line.unitPrice ?? 0),
    unitType: line.unitType,
    lineTotal: line.unitType === "catch_weight"
      ? Number(line.weightLbs) * Number(line.unitPrice)
      : (line.quantityCases ?? 0) * Number(line.unitPrice),
  }));

  const okCount = Object.values(lineStates).filter(s => s.status === "ok").length;
  const flaggedCount = Object.values(lineStates).filter(s => s.status === "flagged").length;
  const walkedCount = okCount + flaggedCount;
  const remaining = lines.length - walkedCount;

  function setLineState(lineId: string, patch: Partial<LineState>) {
    setLineStates(prev => ({
      ...prev,
      [lineId]: { ...{ status: "pending", note: "", photos: [], voiceNote: null }, ...prev[lineId], ...patch },
    }));
  }

  function confirmLine(lineId: string) {
    setLineState(lineId, { status: "ok" });
    if (currentLineIdx < lines.length - 1) setCurrentLineIdx(i => i + 1);
    else setStep("signoff");
  }

  function openFlag(lineId: string) {
    setFlaggingLineId(lineId);
    setStep("flagging");
  }

  function saveFlag() {
    if (!flaggingLineId) return;
    const existing = lineStates[flaggingLineId];
    if (existing && !existing.discrepancy) {
      setLineState(flaggingLineId, { status: "flagged", discrepancy: "short" });
    }
    setStep("walking");
    setFlaggingLineId(null);
    if (currentLineIdx < lines.length - 1) setCurrentLineIdx(i => i + 1);
    else setStep("signoff");
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !flaggingLineId) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setLineState(flaggingLineId, {
        photos: [...(lineStates[flaggingLineId]?.photos ?? []), url],
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function startVoiceNote() {
    if (!flaggingLineId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setLineState(flaggingLineId!, { voiceNote: url });
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopVoiceNote() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }

  const adjustedTotal = lines.reduce((sum, l) => {
    const st = lineStates[l.id];
    if (st?.status === "flagged") return sum; // flagged lines excluded from payment
    return sum + l.lineTotal;
  }, 0);
  const creditOwed = invoice.lines.reduce((sum, l) => {
    const st = lineStates[l.id];
    if (st?.status !== "flagged") return sum;
    const total = l.unitType === "catch_weight"
      ? Number(l.weightLbs) * Number(l.unitPrice)
      : (l.quantityCases ?? 0) * Number(l.unitPrice);
    return sum + total;
  }, 0);

  const elapsedMin = Math.round((Date.now() - startedAt) / 60000);

  async function handleFinish() {
    try {
      await completeMutation.mutateAsync({
        id: invoiceId,
        lineOverrides: lines.map(line => ({
          lineId: line.id,
          lotNumberOverride: null,
          expirationDateOverride: null,
        })),
      });
      toast.success("Receipt complete. Lots and inventory created.");
      router.push(`/supplier-invoices/${invoiceId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not complete receipt.");
    }
  }

  const currentLine = lines[currentLineIdx];
  const flaggingLine = flaggingLineId ? lines.find(l => l.id === flaggingLineId) : null;
  const flaggingState = flaggingLineId ? (lineStates[flaggingLineId] ?? { status: "pending", note: "", photos: [], voiceNote: null }) : null;

  const screenStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column",
    minHeight: "100dvh", background: c.bg,
    maxWidth: 430, margin: "0 auto",
    fontFamily: "inherit",
  };
  const headerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 14px 12px", borderBottom: `1px solid ${c.border}`,
    background: c.card, flexShrink: 0,
  };
  const backBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, background: "var(--color-divider)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "none", cursor: "pointer", flexShrink: 0, color: c.text, fontSize: 18,
  };
  const bigBtn = (variant: "primary" | "green" | "subtle" | "disabled" | "danger"): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    width: "100%", padding: "16px 18px", borderRadius: 14,
    fontSize: 16, fontWeight: 700, border: "none",
    fontFamily: "inherit", cursor: variant === "disabled" ? "default" : "pointer",
    letterSpacing: "-0.005em",
    background: variant === "primary" ? c.accent
      : variant === "green" ? c.green
      : variant === "danger" ? "transparent"
      : variant === "disabled" ? "var(--color-border-default)"
      : "var(--color-divider)",
    color: variant === "primary" ? "var(--color-card)"
      : variant === "green" ? "var(--color-card)"
      : variant === "danger" ? c.red
      : variant === "disabled" ? c.text2
      : c.text,
    ...(variant === "danger" ? { border: `2px solid ${c.red}` } : {}),
  });

  // ── SCREEN 1: Check-in ──────────────────────────────────────────────────────
  if (step === "checkin") {
    const totalWeight = lines.reduce((s, l) => s + l.weightLbs, 0);
    const totalCases = lines.reduce((s, l) => s + l.quantityCases, 0);
    return (
      <div style={screenStyle}>
        <OfflineBanner />
        <div style={headerStyle}>
          <button onClick={() => router.push(`/supplier-invoices/${invoiceId}`)} style={backBtn}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>New receipt</div>
            <div style={{ fontSize: 11.5, color: c.text2 }}>{invoice.supplier?.name}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: "16px 14px", overflowY: "auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em", margin: "0 0 4px" }}>Truck arrived</h2>
          <p style={{ fontSize: 13, color: c.text2, marginTop: 0, marginBottom: 18 }}>Quick check before we start walking the load.</p>

          <div style={{ background: "var(--color-page)", border: `1px solid ${c.border}`, borderRadius: 12, padding: "13px 14px", marginBottom: 12 }}>
            {[
              { label: "Invoice", value: invoice.invoiceNumber },
              { label: "Supplier", value: invoice.supplier?.name ?? "—" },
              { label: "Receive date", value: formatDisplayDate(invoice.receiveDate) },
            ].map((row, i) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", ...(i > 0 ? { borderTop: `1px dashed ${c.border}`, marginTop: 4, paddingTop: 8 } : {}) }}>
                <span style={{ fontSize: 11, color: c.text3, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: c.mono }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{invoice.invoiceNumber}</div>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", background: c.blueBg, color: c.blue, borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>
                {lines.length} lines
              </span>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: c.text2 }}>
              <span><strong style={{ color: c.text, fontFamily: c.mono }}>{totalCases}</strong> cases</span>
              <span><strong style={{ color: c.text, fontFamily: c.mono }}>{totalWeight.toFixed(1)} lb</strong></span>
              <span><strong style={{ color: c.text, fontFamily: c.mono }}>{formatMoney(Number(invoice.totalAmount))}</strong></span>
            </div>
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: "12px 14px 28px", borderTop: `1px solid ${c.border}`, background: c.card }}>
          <button style={bigBtn("primary")} onClick={() => setStep("walking")}>Start receiving →</button>
        </div>
      </div>
    );
  }

  // ── SCREEN 2: Walking the load ──────────────────────────────────────────────
  if (step === "walking") {
    const walkedLines = lines.slice(0, currentLineIdx);
    return (
      <div style={screenStyle}>
        <OfflineBanner />
        <div style={headerStyle}>
          <button onClick={() => setStep("checkin")} style={backBtn}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{invoice.invoiceNumber}</div>
            <div style={{ fontSize: 11.5, color: c.text2 }}>{walkedCount} of {lines.length} walked</div>
          </div>
          <div style={{ fontSize: 11, color: c.text3 }}>{elapsedMin}min</div>
        </div>
        <MobileProgressStrip ok={okCount} flagged={flaggedCount} total={lines.length} />

        {/* Mini stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, padding: "10px 14px 12px", background: c.card, borderBottom: `1px solid ${c.border}` }}>
          {[
            { label: "OK", value: okCount, color: c.green, bg: c.greenBg },
            { label: "Short", value: flaggedCount, color: c.amber, bg: c.amberBg },
            { label: "Damage", value: Object.values(lineStates).filter(s => s.discrepancy === "damaged").length, color: c.red, bg: c.redBg },
            { label: "Left", value: remaining, color: c.text, bg: "var(--color-page)" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center", padding: "7px 6px", borderRadius: 9, background: stat.bg }}>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: c.text3, marginTop: 3 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          {currentLine && (
            <>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: c.text3, margin: "0 0 8px 4px" }}>
                Up next · line {currentLineIdx + 1}
              </div>
              <div style={{ background: c.card, border: `2px solid ${c.accent}`, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 11, background: "var(--color-page)", border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🧺</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{currentLine.productName}</div>
                    <div style={{ fontSize: 11, color: c.text3, fontFamily: c.mono, marginTop: 1 }}>{currentLine.sku}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.text, background: c.accent === "var(--color-ink)" ? "var(--color-divider)" : "var(--color-card)", padding: "2px 7px", borderRadius: 4 }}>{currentLineIdx + 1}/{lines.length}</span>
                </div>
                <div style={{ background: "var(--color-page)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { l: "Cases", v: `${currentLine.quantityCases}` },
                    { l: "Weight", v: `${currentLine.weightLbs.toFixed(2)}` },
                    { l: "Total", v: formatMoney(currentLine.lineTotal) },
                  ].map(s => (
                    <div key={s.l} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: c.text3, marginBottom: 2 }}>{s.l}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: c.mono }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button style={bigBtn("green")} onClick={() => confirmLine(currentLine.id)}>✓ Confirm</button>
                  <button style={bigBtn("danger")} onClick={() => openFlag(currentLine.id)}>⚑ Flag</button>
                </div>
              </div>
            </>
          )}

          {/* Walked lines */}
          {walkedLines.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: c.text3, margin: "16px 0 8px 4px" }}>Already walked</div>
              {walkedLines.map((line, i) => {
                const st = lineStates[line.id];
                const isOk = st?.status === "ok";
                return (
                  <div key={line.id} style={{
                    background: isOk ? c.greenBg : c.amberBg,
                    border: `1px solid ${isOk ? c.greenBorder : c.amberBorder}`,
                    borderRadius: 10, padding: "10px 12px", marginBottom: 6,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--color-page)", border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>🧺</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{line.productName}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: isOk ? c.green : c.amber, marginTop: 2 }}>
                          {isOk ? `✓ OK · ${line.quantityCases} cs · ${line.weightLbs.toFixed(1)} lb` : `⚠ Flagged · ${st?.discrepancy?.replace("_", " ") ?? "discrepancy"}`}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: c.text3, fontFamily: c.mono }}>{i + 1}/{lines.length}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {walkedCount === lines.length && (
          <div style={{ flexShrink: 0, padding: "12px 14px 28px", borderTop: `1px solid ${c.border}`, background: c.card }}>
            <button style={bigBtn("primary")} onClick={() => setStep("signoff")}>Review & sign off →</button>
          </div>
        )}
      </div>
    );
  }

  // ── SCREEN 3: Flag / Discrepancy ────────────────────────────────────────────
  if (step === "flagging" && flaggingLine && flaggingState) {
    const selectedReason = (flaggingState as LineState).discrepancy;
    const photos = (flaggingState as LineState).photos ?? [];
    const voiceNote = (flaggingState as LineState).voiceNote ?? null;
    const creditEst = flaggingLine.unitType === "catch_weight"
      ? flaggingLine.weightLbs * flaggingLine.unitPrice
      : flaggingLine.quantityCases * flaggingLine.unitPrice;

    const reasons: { key: DiscrepancyReason; label: string }[] = [
      { key: "short", label: "Short cases" },
      { key: "underweight", label: "Underweight" },
      { key: "damaged", label: "Damaged" },
      { key: "wrong_item", label: "Wrong item" },
      { key: "temp_fail", label: "Temp fail" },
      { key: "expired", label: "Expired" },
    ];

    return (
      <div style={screenStyle}>
        <OfflineBanner />
        <div style={headerStyle}>
          <button onClick={() => { setStep("walking"); setFlaggingLineId(null); }} style={backBtn}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Flag issue</div>
            <div style={{ fontSize: 11.5, color: c.text2 }}>line {lines.findIndex(l => l.id === flaggingLine.id) + 1} of {lines.length}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
          {/* Product */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-page)", borderRadius: 11, marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: "var(--color-page)", border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🧺</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{flaggingLine.productName}</div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 1 }}>{flaggingLine.sku} · expected {flaggingLine.quantityCases} cs · {flaggingLine.weightLbs.toFixed(2)} lb</div>
            </div>
          </div>

          {/* Reason chips */}
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.text3, margin: "0 0 8px 4px" }}>What&apos;s wrong?</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
            {reasons.map(r => (
              <button key={r.key} onClick={() => setLineState(flaggingLine.id, { status: "flagged", discrepancy: r.key })} style={{
                padding: "11px 12px", borderRadius: 10,
                background: selectedReason === r.key ? c.red : c.card,
                color: selectedReason === r.key ? "var(--color-card)" : c.text,
                border: selectedReason === r.key ? `1.5px solid ${c.red}` : `1.5px solid ${c.borderStrong}`,
                fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer",
                fontFamily: "inherit",
              }}>{r.label}</button>
            ))}
          </div>

          {/* Note */}
          {selectedReason && (
            <input
              type="text"
              value={(flaggingState as LineState).note}
              onChange={e => setLineState(flaggingLine.id, { note: e.target.value })}
              placeholder="Add note (qty received, reason)…"
              style={{
                width: "100%", padding: "10px 12px", marginBottom: 14,
                fontSize: 13, border: `1.5px solid ${c.border}`, borderRadius: 10,
                background: c.card, color: c.text, fontFamily: "inherit", outline: "none",
                boxSizing: "border-box",
              }}
            />
          )}

          {/* Photos */}
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: c.text3, margin: "0 0 8px 4px" }}>
            Photos · {photos.length} of 3 max
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
            {photos.map((photo, i) => (
              <div key={i} style={{ width: 72, height: 72, borderRadius: 11, flexShrink: 0, background: "#e5e7eb", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ))}
            {photos.length < 3 && (
              <button onClick={() => fileInputRef.current?.click()} style={{
                width: 72, height: 72, borderRadius: 11, background: c.accent, color: "var(--color-card)",
                flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3, fontSize: 10, fontWeight: 700,
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}>
                <span style={{ fontSize: 20 }}>📷</span>Camera
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handlePhotoCapture}
            />
          </div>

          {/* Voice note */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: c.blueBg, border: `1px solid ${c.blueBorder}`, borderRadius: 11, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: c.blue, color: "var(--color-card)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>🎙</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{voiceNote ? "Voice note recorded" : isRecording ? "Recording…" : "Add voice note"}</div>
              <div style={{ fontSize: 11, color: c.text2, marginTop: 1 }}>Tap to {isRecording ? "stop" : "record"} · transcribes automatically</div>
            </div>
            {voiceNote ? (
              <audio src={voiceNote} controls style={{ height: 28, width: 100 }} />
            ) : (
              <button onClick={isRecording ? stopVoiceNote : startVoiceNote} style={{
                padding: "5px 10px", background: isRecording ? c.red : c.blue, color: "var(--color-card)",
                border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>{isRecording ? "Stop" : "Record"}</button>
            )}
          </div>

          {/* Credit summary */}
          <div style={{ background: c.amber, color: "var(--color-card)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, opacity: 0.9 }}>Credit owed</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{flaggingLine.weightLbs.toFixed(2)} lb × ${flaggingLine.unitPrice.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: c.mono, letterSpacing: "-0.015em" }}>
              −{formatMoney(creditEst)}
            </div>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: "12px 14px 28px", borderTop: `1px solid ${c.border}`, background: c.card }}>
          <button style={bigBtn("primary")} onClick={saveFlag}>Save &amp; next line →</button>
        </div>
      </div>
    );
  }

  // ── SCREEN 4: Sign-off ─────────────────────────────────────────────────────
  return (
    <div style={screenStyle}>
      <OfflineBanner />
      <div style={{ ...headerStyle, marginTop: 0 }}>
        <button onClick={() => setStep("walking")} style={backBtn}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sign off</div>
          <div style={{ fontSize: 11.5, color: c.text2 }}>all {lines.length} lines walked</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
        {/* Session summary */}
        <div style={{
          background: "linear-gradient(135deg,#18181b 0%,#27272a 100%)",
          color: "var(--color-card)", borderRadius: 14, padding: 18, marginBottom: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "rgba(255,255,255,.6)", marginBottom: 6 }}>
            {invoice.invoiceNumber} receipt complete
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 4 }}>
            {okCount} OK · {flaggedCount} flagged
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{elapsedMin} minutes</div>
        </div>

        {/* 2×2 summary grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { l: "Adjusted total", v: formatMoney(adjustedTotal), bg: "var(--color-page)" },
            { l: "Credit owed", v: formatMoney(creditOwed), bg: c.amberBg, color: c.amber },
          ].map(s => (
            <div key={s.l} style={{ background: s.bg, borderRadius: 10, padding: "11px 12px" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: c.text3, marginBottom: 3 }}>{s.l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.015em", color: s.color ?? c.text }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Driver sig (pre-signed) */}
        <div style={{ background: c.greenBg, border: `1.5px solid ${c.greenBorder}`, borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${c.greenBorder}`, background: "rgba(187,247,208,.4)" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Driver</span>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", background: c.greenBg, color: c.green, borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>Signed</span>
          </div>
          <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", fontStyle: "normal", fontSize: 24, color: c.text, fontFamily: "cursive" }}>
            Driver
          </div>
          <div style={{ padding: "7px 12px", background: "var(--color-page)", fontSize: 10, color: c.text3, display: "flex", justifyContent: "space-between", fontFamily: c.mono }}>
            <span>{invoice.supplier?.name}</span>
            <span>{formatDisplayDate(invoice.receiveDate)}</span>
          </div>
        </div>

        {/* Receiver sig */}
        <div style={{ background: receiverSig ? c.greenBg : c.card, border: `1.5px solid ${receiverSig ? c.greenBorder : c.border}`, borderRadius: 12, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${receiverSig ? c.greenBorder : c.border}`, background: receiverSig ? "rgba(187,247,208,.4)" : "var(--color-page)" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>You · Receiver</span>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", background: receiverSig ? c.greenBg : c.amberBg, color: receiverSig ? c.green : c.amber, borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>
              {receiverSig ? "Signed" : "Tap to sign"}
            </span>
          </div>
          <div style={{ padding: "6px" }}>
            <SignatureCanvas value={receiverSig} onSign={setReceiverSig} />
          </div>
          <div style={{ padding: "7px 12px", background: "var(--color-page)", fontSize: 10, color: c.text3, display: "flex", justifyContent: "space-between", fontFamily: c.mono }}>
            <span>Receiver</span>
            <span>{receiverSig ? new Date().toLocaleTimeString() : "—"}</span>
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: "12px 14px 28px", borderTop: `1px solid ${c.border}`, background: c.card }}>
        <button
          disabled={!receiverSig || completeMutation.isPending}
          onClick={handleFinish}
          style={bigBtn(receiverSig ? "primary" : "disabled")}
        >
          {completeMutation.isPending ? "Saving…" : "Finish & send to office"}
        </button>
        {!receiverSig && (
          <div style={{ textAlign: "center", fontSize: 11, color: c.text3, marginTop: 6 }}>Sign above to enable</div>
        )}
      </div>
    </div>
  );
}
