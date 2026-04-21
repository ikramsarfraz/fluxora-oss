"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";

import { useDeleteSalesOrder, useSalesOrder } from "@/hooks/use-orders";
import { formatDisplayDate } from "@/lib/utils/date";
import { formatMoney } from "@/lib/utils/currency";
import { orderStatusLabel } from "@/lib/utils/status-labels";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailSection,
  DetailField,
  DetailGrid,
} from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  sales_order: "outline",
  confirmed: "secondary",
  fulfilled: "default",
  cancelled: "destructive",
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  catch_weight: "Catch weight",
  fixed_case: "Fixed case",
};

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const {
    data: order,
    isLoading,
    isError,
    error: loadError,
  } = useSalesOrder(orderId);

  const deleteOrder = useDeleteSalesOrder();

  const title = order?.orderNumber ?? (order ? order.id.slice(0, 8) : "");
  useSetBreadcrumbLabel(`/orders/${orderId}`, title || undefined);

  const lineTotal = useMemo(() => {
    if (!order?.lines) return null;
    let total = 0;
    let hasPrice = false;
    for (const line of order.lines) {
      const price = line.pricePerLbOverride
        ? parseFloat(line.pricePerLbOverride)
        : NaN;
      const weight = parseFloat(line.totalBilledWeightLbs ?? "0");
      if (Number.isFinite(price) && Number.isFinite(weight) && weight > 0) {
        total += price * weight;
        hasPrice = true;
      }
    }
    return hasPrice ? total : null;
  }, [order]);

  if (isLoading) return <PageLoading message="Loading order..." />;
  if (isError || !order)
    return (
      <PageError
        message={loadError ? (loadError as Error).message : "Order not found."}
      />
    );

  const lines = order.lines ?? [];

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={title}
        description="Sales order details, fulfillment status, and line items."
        badge={
          <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
            {orderStatusLabel(order.status)}
          </Badge>
        }
      />

      <DetailSection
        title="Details"
        description="Order header, customer, and scheduling."
      >
        <DetailGrid>
          <DetailField label="Order #">
            {order.orderNumber ? (
              <span className="font-mono text-sm">{order.orderNumber}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Customer">
            {order.customer ? (
              <Link
                href={`/customers/${order.customer.id}`}
                className="hover:underline"
              >
                {order.customer.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Order date">
            {formatDisplayDate(order.orderDate)}
          </DetailField>
          <DetailField label="Due date">
            {order.dueDate ? (
              formatDisplayDate(order.dueDate)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Fuel surcharge">
            {order.addFuelSurcharge ? "Applied" : "Not applied"}
          </DetailField>
          <DetailField label="Created">
            {formatDisplayDate(order.createdAt)}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      <DetailSection
        title="Line items"
        description={
          lines.length
            ? `${lines.length} line item${lines.length === 1 ? "" : "s"}.`
            : "No line items on this order."
        }
      >
        {lines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-4 text-left font-medium">Product</th>
                  <th className="py-2 pr-4 text-left font-medium">Unit type</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Cases (fulfilled / expected)
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Billed weight (lbs)
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Price / lb
                  </th>
                  <th className="py-2 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map(line => {
                  const price = line.pricePerLbOverride
                    ? parseFloat(line.pricePerLbOverride)
                    : NaN;
                  const weight = parseFloat(line.totalBilledWeightLbs ?? "0");
                  const total =
                    Number.isFinite(price) && Number.isFinite(weight)
                      ? price * weight
                      : null;
                  return (
                    <tr key={line.id}>
                      <td className="py-2 pr-4">
                        {line.product ? (
                          <Link
                            href={`/products/${line.product.id}`}
                            className="hover:underline"
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              {line.product.sku}
                            </span>{" "}
                            <span>{line.product.name}</span>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">
                          {UNIT_TYPE_LABELS[line.unitType] ?? line.unitType}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {line.fulfilledCases} / {line.expectedCases}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Number(line.totalBilledWeightLbs ?? 0).toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Number.isFinite(price) ? (
                          `${formatMoney(price)}/lb`
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {total != null ? (
                          formatMoney(total)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {lineTotal != null ? (
                <tfoot>
                  <tr className="border-t">
                    <td
                      colSpan={5}
                      className="py-2 pr-4 text-right text-muted-foreground"
                    >
                      Subtotal
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">
                      {formatMoney(lineTotal)}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No line items yet.</p>
        )}
      </DetailSection>

      <DetailSection
        title="Danger Zone"
        description="Irreversible actions for this order."
        className="border-destructive/50"
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              Delete order
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete sales order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{title}</strong> and
                release any allocated inventory back to stock. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteOrder.isPending}
                onClick={() => {
                  deleteOrder.mutate(orderId, {
                    onSuccess: () => router.push("/orders"),
                  });
                }}
              >
                {deleteOrder.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DetailSection>
    </div>
  );
}
