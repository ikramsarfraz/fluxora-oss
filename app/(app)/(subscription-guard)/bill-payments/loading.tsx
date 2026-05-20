import { ListPageSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return <ListPageSkeleton metricCards={4} tableColumns={7} tableRows={10} />;
}
