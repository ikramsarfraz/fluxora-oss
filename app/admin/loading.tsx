import { ListPageSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <ListPageSkeleton tableColumns={6} tableRows={10} />
    </div>
  );
}
