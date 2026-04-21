"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface InlineEditTextareaProps {
  value: string | null | undefined;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  isPending?: boolean;
  onSave: (next: string | null) => void | Promise<void>;
  className?: string;
  rows?: number;
}

export function InlineEditTextarea({
  value,
  placeholder = "Add a note…",
  emptyLabel = "No notes yet.",
  disabled,
  isPending,
  onSave,
  className,
  rows = 3,
}: InlineEditTextareaProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      const len = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(len, len);
    }
  }, [editing]);

  const display = value?.trim() ?? "";
  const hasValue = display.length > 0;

  const startEdit = () => {
    if (disabled) return;
    setDraft(value ?? "");
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  const commit = async () => {
    const trimmed = draft.trim();
    const next = trimmed.length === 0 ? null : draft;
    if ((value ?? "") === (next ?? "")) {
      setEditing(false);
      return;
    }
    await onSave(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <Textarea
          ref={textareaRef}
          value={draft}
          rows={rows}
          placeholder={placeholder}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
          }}
          disabled={isPending}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
              Esc
            </kbd>{" "}
            to cancel ·{" "}
            <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
              ⌘↵
            </kbd>{" "}
            to save
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void commit()}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={disabled}
      className={cn(
        "group/inline-edit flex w-full items-start justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors",
        !disabled &&
          "hover:border-border hover:bg-accent/40 focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      {hasValue ? (
        <span className="whitespace-pre-wrap">{display}</span>
      ) : (
        <span className="italic text-muted-foreground">{emptyLabel}</span>
      )}
      {!disabled && (
        <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/inline-edit:opacity-100" />
      )}
    </button>
  );
}
