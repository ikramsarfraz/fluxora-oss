"use client";

import { Eye, Lock } from "lucide-react";

import { InlineEditTextarea } from "@/components/inline-edit-textarea";
import { useUpdateSalesOrderNotes } from "@/hooks/use-orders";

import type { SalesOrderDetail } from "@/services/orders";

interface OrderNotesSectionProps {
  order: SalesOrderDetail;
  disabled?: boolean;
}

export function OrderNotesSection({
  order,
  disabled,
}: OrderNotesSectionProps) {
  const updateNotes = useUpdateSalesOrderNotes();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-md border bg-amber-500/5 p-3 dark:bg-amber-500/10">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
          <span className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Customer-facing notes
          </span>
          <span className="text-[10px] text-muted-foreground">
            Visible on invoice
          </span>
        </div>
        <InlineEditTextarea
          value={order.customerNotes}
          placeholder="Notes that will appear on the invoice (delivery instructions, packing requests…)"
          emptyLabel="No customer notes."
          disabled={disabled}
          isPending={
            updateNotes.isPending &&
            updateNotes.variables?.customerNotes !== undefined
          }
          onSave={next =>
            updateNotes.mutateAsync({
              id: order.id,
              customerNotes: next,
            })
          }
        />
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Internal notes
          </span>
          <span className="text-[10px] text-muted-foreground">
            Staff only
          </span>
        </div>
        <InlineEditTextarea
          value={order.internalNotes}
          placeholder="Internal notes for warehouse and office staff…"
          emptyLabel="No internal notes."
          disabled={disabled}
          isPending={
            updateNotes.isPending &&
            updateNotes.variables?.internalNotes !== undefined
          }
          onSave={next =>
            updateNotes.mutateAsync({
              id: order.id,
              internalNotes: next,
            })
          }
        />
      </div>
    </div>
  );
}
