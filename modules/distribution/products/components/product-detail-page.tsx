"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  useArchiveProduct,
  usePermanentlyDeleteProduct,
  useProduct,
  useRestoreProduct,
} from "../hooks/use-products";
import {
  formatProductDefaultPrice,
  getProductBaseUnitAbbreviation,
} from "../utils/product-uom";
import { formatDisplayDateTime } from "@/lib/utils/date";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { SkuIntelligenceEmptyState } from "@/modules/distribution/components/empty-states";

const PURPOSE_LABELS: Record<string, string> = {
  stock: "Stock",
  purchase: "Purchase",
  sales: "Sales",
  pricing: "Pricing",
  display: "Display",
};

export function ProductDetailPage({ productId }: { productId: string }) {
  const router = useRouter();
  const {
    data: product,
    isLoading,
    error: loadError,
    isError,
  } = useProduct(productId);

  useSetBreadcrumbLabel(`/products/${productId}`, product?.name);

  const archiveProduct = useArchiveProduct();
  const restoreProduct = useRestoreProduct();
  const permanentlyDeleteProduct = usePermanentlyDeleteProduct();
  const [confirmingPermanentDelete, setConfirmingPermanentDelete] =
    useState(false);

  if (isLoading) return <PageLoading message="Loading product..." />;
  if (isError || !product)
    return (
      <PageError
        message={
          loadError ? (loadError as Error).message : "Product not found."
        }
      />
    );

  const categories = product.productCategories ?? [];
  const units = product.productUnits ?? [];
  const isArchived = !!product.archivedAt;
  const canPermanentlyDelete = product._dependentRecordCount === 0;

  const baseUnitAbbr = getProductBaseUnitAbbreviation(product);

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={product.name}
        description={`Default price/${baseUnitAbbr} is a reference; set customer-specific prices in each customer profile.`}
        badge={
          <span className="inline-flex items-center gap-1.5">
            <Badge variant="secondary" className="font-mono">
              {product.sku}
            </Badge>
            {isArchived ? (
              <Badge
                variant="secondary"
                className="rounded-full px-2 text-[11px] font-medium uppercase tracking-wide"
              >
                Archived
              </Badge>
            ) : null}
          </span>
        }
      >
        <Button variant="outline" asChild>
          <Link href={`/products/${product.id}/edit`}>
            <Pencil className="size-4" />
            Edit
          </Link>
        </Button>
      </DetailPageHeader>

      {/* Core details */}
      <DetailSection
        title="Details"
        description="Pricing and base unit configuration."
      >
        <DetailGrid>
          <DetailField label="SKU">
            <span className="font-mono text-sm">{product.sku}</span>
          </DetailField>
          <DetailField label={`Default price / ${baseUnitAbbr}`}>
            {(() => {
              const formatted = formatProductDefaultPrice(
                product.defaultPricePerLb,
              );
              return formatted === "—" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <>
                  {formatted}
                  <span className="ml-1 text-xs text-muted-foreground">
                    /{baseUnitAbbr}
                  </span>
                </>
              );
            })()}
          </DetailField>
          <DetailField label="Base unit">
            {product.baseUnit
              ? product.baseUnit.abbreviation
                ? `${product.baseUnit.name} (${product.baseUnit.abbreviation})`
                : product.baseUnit.name
              : <span className="text-muted-foreground">—</span>}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      {/* Categories */}
      <DetailSection
        title="Categories"
        description={
          categories.length
            ? `${categories.length} categor${categories.length === 1 ? "y" : "ies"} assigned.`
            : "No categories assigned."
        }
      >
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map(pc => (
              <Badge key={pc.category.id} variant="secondary">
                {pc.category.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        )}
      </DetailSection>

      {/* Units of measure */}
      <DetailSection
        title="Units of measure"
        description="How this product is stocked, purchased, and sold."
      >
        {units.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Conversion to base</TableHead>
                  <TableHead>Fractional</TableHead>
                  <TableHead>Default</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map(pu => (
                  <TableRow key={pu.id}>
                    <TableCell>
                      {pu.unit.abbreviation
                        ? `${pu.unit.name} (${pu.unit.abbreviation})`
                        : pu.unit.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {PURPOSE_LABELS[pu.purpose] ?? pu.purpose}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {Number(pu.conversionToBase).toString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pu.allowsFractional ? "Yes" : "No"}
                    </TableCell>
                    <TableCell>
                      {pu.isDefault ? (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No units configured.</p>
        )}
      </DetailSection>

      {product._purchaseCount < 3 && (
        <DetailSection
          title="Price intelligence"
          description="Unlocks after 3 purchases — enough to establish a baseline average and flag drift."
        >
          <SkuIntelligenceEmptyState
            purchaseCount={product._purchaseCount}
            productName={product.name}
          />
        </DetailSection>
      )}

      {/* Activity — audit trail from products.created_by_user_id /
          products.updated_by_user_id. Rows created before those columns
          were wired up will show "—" for the actor; the timestamp is
          always present because the columns are NOT NULL with defaultNow. */}
      <DetailSection
        title="Activity"
        description="Who created this product and when it was last edited."
      >
        <DetailGrid>
          <DetailField label="Created by">
            {product.createdBy?.fullName ?? product.createdBy?.email ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Created at">
            {formatDisplayDateTime(product.createdAt)}
          </DetailField>
          <DetailField label="Last edited by">
            {product.updatedBy?.fullName ?? product.updatedBy?.email ?? (
              <span className="text-muted-foreground">—</span>
            )}
          </DetailField>
          <DetailField label="Last edited at">
            {formatDisplayDateTime(product.updatedAt)}
          </DetailField>
        </DetailGrid>
      </DetailSection>

      {/* Lifecycle — archive (active products), restore (archived
          products), and permanent-delete (only when the product has
          zero dependent rows; the service double-checks and throws a
          human-readable error otherwise). */}
      <DetailSection
        title="Lifecycle"
        description={
          isArchived
            ? "Restore the product to make it selectable again, or remove it permanently."
            : "Archive hides the product from new orders while preserving history. Permanent delete is only available before the product has any business activity."
        }
        className="border-destructive/50"
      >
        <div className="flex flex-wrap gap-2">
          {/* Archive (active only) — primary lifecycle verb. Uses the
              destructive theme because it's a removal-flavoured action;
              Restore (below) is the affirmative counterpart. */}
          {!isArchived ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline">
                  Archive product
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Hide <strong>{product.name}</strong> from new orders and
                    receiving pickers. Historical lines, prices, and bills
                    stay intact. You can restore it later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={archiveProduct.isPending}
                    onClick={() => {
                      archiveProduct.mutate(productId, {
                        onSuccess: () => {
                          toast.success("Product archived.");
                          router.push("/products");
                        },
                        onError: e =>
                          toast.error(
                            e instanceof Error ? e.message : "Archive failed.",
                          ),
                      });
                    }}
                  >
                    {archiveProduct.isPending ? "Archiving…" : "Archive"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          {/* Restore (archived only) */}
          {isArchived ? (
            <Button
              type="button"
              variant="outline"
              disabled={restoreProduct.isPending}
              onClick={() =>
                restoreProduct.mutate(productId, {
                  onSuccess: () => toast.success("Product restored."),
                  onError: e =>
                    toast.error(
                      e instanceof Error ? e.message : "Restore failed.",
                    ),
                })
              }
            >
              {restoreProduct.isPending ? "Restoring…" : "Restore product"}
            </Button>
          ) : null}

          {/* Permanent delete — guarded by _dependentRecordCount.
              Showing the button always (even when disabled) so the
              affordance is discoverable, with the tooltip-via-title
              explaining why it's locked. The service runs the same
              check server-side as a defense-in-depth. */}
          <AlertDialog
            open={confirmingPermanentDelete}
            onOpenChange={open => {
              if (!open) setConfirmingPermanentDelete(false);
            }}
          >
            <Button
              type="button"
              variant="outline"
              disabled={!canPermanentlyDelete || permanentlyDeleteProduct.isPending}
              title={
                canPermanentlyDelete
                  ? undefined
                  : "Has dependent records — archive instead."
              }
              onClick={() => setConfirmingPermanentDelete(true)}
            >
              {permanentlyDeleteProduct.isPending
                ? "Deleting…"
                : "Delete permanently"}
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes <strong>{product.name}</strong>{" "}
                  and can’t be undone. Available only because this product
                  has no orders, invoices, prices, or bills referencing
                  it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={permanentlyDeleteProduct.isPending}
                  onClick={() => {
                    permanentlyDeleteProduct.mutate(productId, {
                      onSuccess: () => {
                        toast.success("Product deleted.");
                        router.push("/products");
                      },
                      onError: e =>
                        toast.error(
                          e instanceof Error ? e.message : "Delete failed.",
                        ),
                    });
                    setConfirmingPermanentDelete(false);
                  }}
                >
                  {permanentlyDeleteProduct.isPending
                    ? "Deleting…"
                    : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DetailSection>
    </div>
  );
}
