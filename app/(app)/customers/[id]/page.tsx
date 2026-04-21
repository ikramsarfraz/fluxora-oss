"use client";

import { useParams } from "next/navigation";

import { useCustomer } from "@/hooks/use-customer";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  DetailSection,
  DetailField,
  DetailGrid,
} from "@/components/detail-section";
import { PageLoading } from "@/components/page-loading";
import { PageError } from "@/components/page-error";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/utils/phone";
import { useSetBreadcrumbLabel } from "@/components/breadcrumb-label-provider";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADDRESS_TYPE_LABEL: Record<string, string> = {
  shipping: "Shipping",
  billing: "Billing",
  warehouse: "Warehouse",
  other: "Other",
};

export default function CustomerProfile() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const customerId = id ?? "";

  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError,
  } = useCustomer(customerId);

  useSetBreadcrumbLabel(`/customers/${customerId}`, customer?.name);

  if (!UUID_RE.test(customerId)) {
    return <PageError message="Invalid customer ID." />;
  }
  if (customerLoading) {
    return <PageLoading message="Loading customer..." />;
  }
  if (customerError) {
    return <PageError message={(customerError as Error).message} />;
  }
  if (!customer) return null;

  const hasContactDetails =
    customer.phoneNumber ||
    customer.fuelSurchargeAmount != null ||
    customer.invoicePrefix;

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={customer.name}
        description="View and manage contact details, addresses, and pricing."
      />

      {/* General details */}
      {hasContactDetails && (
        <DetailSection
          title="Details"
          description="Contact information and billing configuration."
        >
          <DetailGrid>
            {customer.phoneNumber && (
              <DetailField label="Phone">
                {formatPhone(customer.phoneNumber)}
              </DetailField>
            )}
            {customer.fuelSurchargeAmount != null && (
              <DetailField label="Fuel surcharge">
                ${Number(customer.fuelSurchargeAmount).toFixed(2)}/lb
              </DetailField>
            )}
            {customer.invoicePrefix && (
              <DetailField label="Invoice prefix">
                {customer.invoicePrefix}
              </DetailField>
            )}
          </DetailGrid>
        </DetailSection>
      )}

      {/* Addresses */}
      {customer.addresses.length > 0 && (
        <DetailSection
          title="Addresses"
          description={`${customer.addresses.length} address${customer.addresses.length !== 1 ? "es" : ""} on file.`}
        >
          <div className="flex flex-col divide-y">
            {customer.addresses.map(addr => {
              const line2 = [addr.city, addr.state, addr.zip]
                .filter(Boolean)
                .join(", ");
              return (
                <div key={addr.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{addr.street}</p>
                    {line2 && (
                      <p className="text-sm text-muted-foreground">{line2}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize">
                      {ADDRESS_TYPE_LABEL[addr.addressType] ?? addr.addressType}
                    </Badge>
                    {addr.isDefault && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DetailSection>
      )}
    </div>
  );
}
