import { DetailPageSkeleton } from "@/components/loading-skeletons";

// No wrapper — the app layout at app/(app)/layout.tsx already provides
// `flex flex-col gap-4 p-4` around `children`. Adding another padded wrapper
// here caused a visible width shift when the page mounted and React Query's
// loading branch rendered the same skeleton without the extra padding.
export default function Loading() {
  return <DetailPageSkeleton sections={4} />;
}
