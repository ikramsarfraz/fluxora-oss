"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCcw } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type InvoicePdfPreviewProps = {
  invoiceId: string;
  invoiceNumber: string;
};

export function InvoicePdfPreview({
  invoiceId,
  invoiceNumber,
}: InvoicePdfPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(() => Date.now());

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;
  const refreshPreview = () => setReloadKey(Date.now());

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    async function loadPreview() {
      setIsLoading(true);
      setError(null);
      setPreviewUrl(null);

      try {
        const response = await fetch(`${pdfUrl}?preview=1&v=${reloadKey}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await response.text().catch(() => "");
          throw new Error(message || `Preview failed with ${response.status}`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().includes("application/pdf")) {
          const message = await response.text().catch(() => "");
          throw new Error(message || "Preview did not return a PDF.");
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw new Error("Preview returned an empty PDF.");
        }

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Unable to load invoice preview.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [pdfUrl, reloadKey]);

  if (error) {
    return (
      <div className="flex min-h-[360px] flex-col gap-4 bg-muted/20 p-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Preview unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshPreview}
          >
            <RefreshCcw className="size-4" />
            Retry
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`${pdfUrl}?preview=1`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open PDF
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[78vh] min-h-[640px] flex-col bg-muted/20">
      <div className="flex items-center justify-end border-b bg-background/80 px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refreshPreview}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCcw className="size-4" />
          )}
          Refresh preview
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading preview
          </div>
        ) : null}
        {previewUrl ? (
          <object
            aria-label={`Invoice ${invoiceNumber} PDF preview`}
            data={`${previewUrl}#toolbar=0&navpanes=0`}
            type="application/pdf"
            className="h-full w-full"
          >
            <div className="flex h-full min-h-[360px] items-center justify-center p-4">
              <Button asChild variant="outline" size="sm">
                <a href={`${pdfUrl}?preview=1`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open PDF
                </a>
              </Button>
            </div>
          </object>
        ) : null}
      </div>
    </div>
  );
}
