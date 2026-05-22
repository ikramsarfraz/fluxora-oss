import { ListPageSkeleton } from "@/components/loading-skeletons";

// Listing column count matches the COLUMNS array in
// modules/distribution/products/components/products-page.tsx — SKU, Name,
// Default price, plus the row-action affordance.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-2 lg:px-6">
      <ListPageSkeleton tableColumns={4} />
    </div>
  );
}
