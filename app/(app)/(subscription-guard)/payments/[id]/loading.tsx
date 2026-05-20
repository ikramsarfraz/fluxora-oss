import { DetailPageSkeleton } from "@/components/loading-skeletons";

// PaymentDetailPage renders ~3 DetailSections (Summary, Linked invoice,
// Customer / Other payments / Metadata). Pick 3 for the closest match.
export default function Loading() {
  return <DetailPageSkeleton sections={3} />;
}
