import { FormPageSkeleton } from "@/components/loading-skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 pt-2 lg:px-6">
      <FormPageSkeleton sections={2} fieldsPerSection={6} />
    </div>
  );
}
