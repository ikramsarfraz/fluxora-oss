"use client";

import Link from "next/link";
import { Building2, CalendarDays, Clock3, FileBadge2, Truck } from "lucide-react";

import {
  DetailField,
  DetailGrid,
  DetailSection,
} from "@/components/detail-section";
import { Badge } from "@/components/ui/badge";
import { formatDisplayDate } from "@/lib/utils/date";

import type { SalesOrderDetail } from "@/services/orders";

import { OrderNotesSection } from "./order-notes-section";

interface OrderDetailsCardProps {
  order: SalesOrderDetail;
}

export function OrderDetailsCard({ order }: OrderDetailsCardProps) {
  const customer = order.customer;

  return (
    <DetailSection
      title="Customer + order details"
      description="Customer account, scheduling, and internal order context."
    >
      <div className="flex flex-col gap-6">
        <DetailGrid className="lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Customer account</h3>
            </div>
            <DetailGrid className="grid-cols-1 gap-3">
              <DetailField label="Customer">
                {customer ? (
                  <Link href={`/customers/${customer.id}`} className="hover:underline">
                    {customer.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailField>
              <DetailField label="Phone">
                {customer?.phoneNumber ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailField>
              <DetailField label="Fuel surcharge">
                <Badge variant={order.addFuelSurcharge ? "secondary" : "outline"}>
                  {order.addFuelSurcharge ? "Applied" : "Not applied"}
                </Badge>
              </DetailField>
              <DetailField label="Invoice status">
                {order.invoices?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {order.invoices.map(invoice => (
                      <Badge key={invoice.id} variant="outline" className="font-mono">
                        {invoice.invoiceNumber}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">
                    No invoice generated yet.
                  </span>
                )}
              </DetailField>
            </DetailGrid>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Order scheduling</h3>
            </div>
            <DetailGrid className="grid-cols-1 gap-3">
              <DetailField label="Order #">
                {order.orderNumber ? (
                  <span className="font-mono text-sm">{order.orderNumber}</span>
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
              <DetailField label="Created">
                <div className="flex flex-col">
                  <span>{formatDisplayDate(order.createdAt)}</span>
                  {order.createdBy?.fullName ? (
                    <span className="text-xs text-muted-foreground">
                      by {order.createdBy.fullName}
                    </span>
                  ) : null}
                </div>
              </DetailField>
              <DetailField label="Last updated">
                <div className="flex flex-col">
                  <span>{formatDisplayDate(order.updatedAt)}</span>
                  {order.updatedBy?.fullName ? (
                    <span className="text-xs text-muted-foreground">
                      by {order.updatedBy.fullName}
                    </span>
                  ) : null}
                </div>
              </DetailField>
            </DetailGrid>
          </div>
        </DetailGrid>

        <div className="grid gap-4 md:grid-cols-3">
          <OperationalChip
            icon={Truck}
            label="Fulfillment lane"
            value={
              order.status === "fulfilled"
                ? "Closed"
                : order.status === "confirmed"
                  ? "Ready for warehouse"
                  : "Waiting on confirmation"
            }
          />
          <OperationalChip
            icon={FileBadge2}
            label="Billing lane"
            value={
              order.invoices?.length
                ? `${order.invoices.length} invoice${order.invoices.length === 1 ? "" : "s"}`
                : "Not invoiced"
            }
          />
          <OperationalChip
            icon={Clock3}
            label="Order state"
            value={order.status.replaceAll("_", " ")}
          />
        </div>

        <OrderNotesSection
          order={order}
          disabled={order.status === "cancelled"}
        />
      </div>
    </DetailSection>
  );
}

function OperationalChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium capitalize">{value}</div>
    </div>
  );
}
