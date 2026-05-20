import { ListPageSkeleton } from "@/components/loading-skeletons";

// Page has 4 KPI tiles above the table + a filter bar. ListPageSkeleton
// renders metric cards via metricCards prop; the filter bar's height is
// small enough that the omission isn't a noticeable jump.
export default function Loading() {
  return <ListPageSkeleton metricCards={4} tableColumns={7} tableRows={10} />;
}
