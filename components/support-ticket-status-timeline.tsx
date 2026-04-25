import { CheckCircle2, Circle, CircleDot } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SUPPORT_TICKET_STATUSES,
  supportTicketStatusLabel,
  type SupportTicketStatus,
} from "@/lib/support/metadata";

const statusOrder: SupportTicketStatus[] = ["open", "in_progress", "resolved"];

export function SupportTicketStatusTimeline({
  status,
  className,
}: {
  status: SupportTicketStatus;
  className?: string;
}) {
  const activeIndex = statusOrder.indexOf(status);

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {SUPPORT_TICKET_STATUSES.map((item, index) => {
        const isComplete = index < activeIndex;
        const isCurrent = index === activeIndex;
        const Icon = isComplete ? CheckCircle2 : isCurrent ? CircleDot : Circle;

        return (
          <div
            key={item.value}
            className={cn(
              "rounded-lg border p-3",
              isCurrent
                ? "border-blue-200 bg-blue-50 text-blue-900"
                : isComplete
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "text-muted-foreground",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="size-4" />
              <span className="text-sm font-medium">
                {supportTicketStatusLabel(item.value)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
