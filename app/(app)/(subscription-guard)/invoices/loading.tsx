import { ListPageSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return <ListPageSkeleton tableColumns={7} tableRows={10} />;
}
