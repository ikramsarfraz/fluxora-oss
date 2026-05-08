"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { useProduct, useDeleteProduct } from "../hooks/use-products";
import { formatMoney } from "@/lib/utils/currency";
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

  return (
    <div className="flex flex-col gap-6">
      <DetailPageHeader
        title={product.name}
        description="Default price/lb is a reference; set customer-specific prices in each customer profile."
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
          <DetailField label="Default price / lb">
            {formatMoney(product.defaultPricePerLb)}/lb
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-4 text-left font-medium">Unit</th>
                  <th className="py-2 pr-4 text-left font-medium">Purpose</th>
                  <th className="py-2 pr-4 text-left font-medium">Conversion to base</th>
                  <th className="py-2 pr-4 text-left font-medium">Fractional</th>
                  <th className="py-2 text-left font-medium">Default</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {units.map(pu => (
                  <tr key={pu.id}>
                    <td className="py-2 pr-4">
                      {pu.unit.abbreviation
                        ? `${pu.unit.name} (${pu.unit.abbreviation})`
                        : pu.unit.name}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="text-xs">
                        {PURPOSE_LABELS[pu.purpose] ?? pu.purpose}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono">
                      {Number(pu.conversionToBase).toString()}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {pu.allowsFractional ? "Yes" : "No"}
                    </td>
                    <td className="py-2">
                      {pu.isDefault ? (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No units configured.</p>
        )}
      </DetailSection>

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
