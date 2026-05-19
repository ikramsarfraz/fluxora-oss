import { ListPageSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4">
      <div className="px-4 pt-2 lg:px-6">
        <ListPageSkeleton tableColumns={6} tableRows={10} />
      </div>
    </div>
  );
}
