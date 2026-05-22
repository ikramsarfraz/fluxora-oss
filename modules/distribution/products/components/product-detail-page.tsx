"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { useProduct, useDeleteProduct } from "../hooks/use-products";
import {
  formatProductDefaultPrice,
  getProductBaseUnitAbbreviation,
} from "../utils/product-uom";
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

  const deleteProduct = useDeleteProduct();

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

  const baseUnitAbbr = getProductBaseUnitAbbreviation(product);

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={product.name}
        description={`Default price/${baseUnitAbbr} is a reference; set customer-specific prices in each customer profile.`}
        badge={
          <Badge variant="secondary" className="font-mono">
            {product.sku}
          </Badge>
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

      {/* Danger zone */}
      <DetailSection
        title="Danger Zone"
        description="Irreversible actions for this product."
        className="border-destructive/50"
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              Delete product
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete product?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete{" "}
                <strong>{product.name}</strong> and all associated data.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteProduct.isPending}
                onClick={() => {
                  deleteProduct.mutate(productId, {
                    onSuccess: () => router.push("/products"),
                  });
                }}
              >
                {deleteProduct.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DetailSection>
    </div>
  );
}
