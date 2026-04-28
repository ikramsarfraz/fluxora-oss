"use client";

import { OrderFulfillmentEntryDialog } from "./order-fulfillment-entry-dialog";

import type { SalesOrderDetail } from "@/services/orders";

interface OrderFulfillmentEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SalesOrderDetail;
}

export function OrderFulfillmentEntryModal({
  open,
  onOpenChange,
  order,
}: OrderFulfillmentEntryModalProps) {
  return (
    <OrderFulfillmentEntryDialog
      open={open}
      onOpenChange={onOpenChange}
      order={order}
    />
  );
}
