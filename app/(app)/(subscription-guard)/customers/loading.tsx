import { ListPageSkeleton } from "@/components/loading-skeletons";

// Column count tracks the COLUMNS array in
// modules/distribution/customers/components/customers-page.tsx; bumped
// by one to account for the row-action affordance the table renders.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-2 lg:px-6">
      <ListPageSkeleton tableColumns={5} />
    </div>
  );
}
