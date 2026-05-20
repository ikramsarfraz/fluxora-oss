import { DetailPageSkeleton } from "@/components/loading-skeletons";

// Detail page renders a 1fr + 300px grid (invoice document + sidebar);
// the skeleton sticks with the generic 3-section detail layout — close
// enough that there's no perceived layout jump when the real page mounts.
export default function Loading() {
  return <DetailPageSkeleton sections={3} />;
}
