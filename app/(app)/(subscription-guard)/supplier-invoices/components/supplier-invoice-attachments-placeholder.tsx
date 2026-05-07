"use client";

import { FileUp, Paperclip } from "lucide-react";

const C = {
  ink: "#0c0a09",
  muted: "#78716c",
  surface: "#ffffff",
  line: "#e7e5e4",
  line2: "#f5f5f4",
  radius: "10px",
} as const;

/**
 * Shown on the create/edit form only. Real attachment upload lives on the
 * supplier invoice detail page where we have a stable `supplierInvoiceId`
 * to attach files to (see `SupplierInvoiceAttachmentsCard`).
 */
export function SupplierInvoiceAttachmentsPlaceholder() {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: C.radius,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          fontWeight: 600,
          color: C.ink,
          marginBottom: "4px",
        }}
      >
        <Paperclip style={{ width: "14px", height: "14px" }} />
        Supporting documents
      </div>
      <div style={{ fontSize: "13px", color: C.muted, marginBottom: "16px" }}>
        Attach the supplier&apos;s PDF invoice, bill of lading, packing slip, or
        photos of the shipment.
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          border: `1px dashed ${C.line}`,
          borderRadius: "6px",
          background: C.line2,
          padding: "36px 24px",
          textAlign: "center",
        }}
      >
        <FileUp style={{ width: "28px", height: "28px", color: C.muted, opacity: 0.5 }} />
        <div style={{ fontSize: "13px", fontWeight: 500, color: C.muted }}>
          Save the draft to attach documents
        </div>
        <div style={{ fontSize: "12px", color: C.muted }}>
          Uploads are available from the invoice detail page once the draft exists.
        </div>
      </div>
    </div>
  );
}
