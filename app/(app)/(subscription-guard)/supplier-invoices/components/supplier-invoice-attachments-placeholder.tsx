"use client";

import { FileUp, Paperclip } from "lucide-react";

const C = {
  ink: "#0c0a09",
  muted: "#78716c",
  mutedSoft: "#a8a29e",
  surface: "#ffffff",
  surfaceAlt: "#f5f5f4",
  line: "#e7e5e4",
  lineStrong: "#d4d1c7",
  accent: "oklch(60% 0.15 240)",
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
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "20px 28px",
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 16,
            fontWeight: 600,
            color: C.ink,
            marginBottom: 4,
          }}
        >
          <Paperclip style={{ width: 14, height: 14 }} />
          Supporting documents
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          Attach the supplier&apos;s PDF invoice, bill of lading, packing
          slip, or photos of the shipment.
        </div>
      </div>

      {/* Drop zone */}
      <div style={{ padding: "20px 28px 28px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            border: `1.5px dashed ${C.lineStrong}`,
            borderRadius: 12,
            background: C.surfaceAlt,
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              width: 44,
              height: 44,
              borderRadius: 12,
              background: C.surface,
              border: `1px solid ${C.line}`,
              alignItems: "center",
              justifyContent: "center",
              color: C.mutedSoft,
              marginBottom: 6,
            }}
          >
            <FileUp style={{ width: 20, height: 20 }} />
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: C.ink,
            }}
          >
            Drop files or{" "}
            <span
              style={{
                color: C.accent,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              browse
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            PDF, JPG, PNG up to 25 MB · multiple files supported
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: C.mutedSoft,
              fontStyle: "italic",
            }}
          >
            Save the draft first to enable uploads
          </div>
        </div>
      </div>
    </div>
  );
}
