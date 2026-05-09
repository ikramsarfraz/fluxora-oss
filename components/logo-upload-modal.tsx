"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useRemoveTenantLogo,
  useTenantLogoUrl,
  useUploadTenantLogo,
} from "@/modules/core/workspace-settings/hooks/use-tenant-branding";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_MB = 2;

function isAcceptedType(type: string) {
  return ACCEPTED_TYPES.includes(type);
}

interface LogoUploadModalProps {
  /** Trigger element (e.g. a Button). If omitted a default button is rendered. */
  trigger?: React.ReactNode;
}

export function LogoUploadModal({ trigger }: LogoUploadModalProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: currentLogoUrl, isLoading: logoLoading } = useTenantLogoUrl();
  const upload = useUploadTenantLogo();
  const remove = useRemoveTenantLogo();

  const isBusy = upload.isPending || remove.isPending;

  function resetPending() {
    setPreview(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleClose(next: boolean) {
    if (!next) resetPending();
    setOpen(next);
  }

  function processFile(file: File) {
    if (!isAcceptedType(file.type)) {
      toast.error("Only PNG, JPEG, WebP, and SVG files are accepted.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File must be ${MAX_MB} MB or smaller.`);
      return;
    }
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [],
  );

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  async function onUpload() {
    if (!pendingFile) return;
    try {
      await upload.mutateAsync(pendingFile);
      toast.success("Logo updated.");
      resetPending();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  async function onRemove() {
    try {
      await remove.mutateAsync();
      toast.success("Logo removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed.");
    }
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <ImagePlus className="mr-2 h-4 w-4" />
      Change logo
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Company logo</DialogTitle>
          <DialogDescription>
            PNG, JPEG, WebP, or SVG. Max {MAX_MB} MB. Shown in the sidebar and
            on documents like invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {/* Current logo */}
          {!preview && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-muted-foreground">Current logo</p>
              <div className="flex h-20 w-full items-center justify-center rounded-md border bg-muted/30">
                {logoLoading ? (
                  <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                ) : currentLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentLogoUrl}
                    alt="Current logo"
                    className="max-h-16 max-w-[200px] object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo set</span>
                )}
              </div>
            </div>
          )}

          {/* Preview of pending file */}
          {preview && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Preview</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={resetPending}
                  disabled={isBusy}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Clear selection</span>
                </Button>
              </div>
              <div className="flex h-24 w-full items-center justify-center rounded-md border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                  src={preview}
                  alt="Preview"
                  className="max-h-20 max-w-[240px] object-contain"
                />
              </div>
              {pendingFile && (
                <p className="text-xs text-muted-foreground truncate">
                  {pendingFile.name} ({(pendingFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          )}

          {/* Drop zone */}
          {!preview && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop zone — click or drag a logo file here"
              className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 transition-colors cursor-pointer select-none ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"
              }`}
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                <span className="font-medium text-foreground">Click to browse</span>{" "}
                or drag and drop your logo here
              </p>
              <p className="text-xs text-muted-foreground">PNG · JPEG · WebP · SVG · max {MAX_MB} MB</p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="sr-only"
            onChange={onInputChange}
          />

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Remove current logo */}
            {currentLogoUrl && !preview && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={isBusy}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove logo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove company logo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The logo will be permanently deleted. The sidebar will fall
                      back to the default logo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onRemove}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClose(false)}
                disabled={isBusy}
              >
                Cancel
              </Button>
              {preview && (
                <Button
                  size="sm"
                  onClick={onUpload}
                  disabled={isBusy || !pendingFile}
                >
                  {upload.isPending ? "Uploading…" : "Save logo"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
