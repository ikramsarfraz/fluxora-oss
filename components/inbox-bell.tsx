"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { getInboxBellSummaryAction } from "@/modules/distribution/inbox/actions";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function relativeTime(date: Date): string {
  const now = Date.now();
  const t = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(t));
}

export function InboxBell() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.inbox.bellSummary,
    queryFn: getInboxBellSummaryAction,
    staleTime: 1000 * 60 * 2,
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];
  const hasUnread = unread > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={hasUnread ? `Inbox — ${unread} new` : "Inbox"}
          className={cn(
            "relative grid size-7 shrink-0 place-items-center rounded-md border text-ink-warm transition-colors",
            "hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1",
            // Subtle green tint matches the prototype's "has unread" affordance.
            "border-[oklch(85%_0.08_155)] bg-[oklch(95%_0.05_155)]",
          )}
        >
          <Bell className="size-3.5" strokeWidth={1.8} />
          {hasUnread ? (
            <span
              aria-hidden
              className="absolute right-[5px] top-[4px] size-[7px] rounded-full bg-[var(--color-success-fg,oklch(58%_0.13_155))] ring-[1.5px] ring-card"
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-[360px] p-0"
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex h-[440px] flex-col">
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <span className="text-[14px] font-semibold text-ink">Inbox</span>
            {hasUnread ? (
              <span className="text-[11px] text-subtle">{unread} new</span>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-[13px] text-subtle">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-subtle">
                You&apos;re all caught up.
              </div>
            ) : (
              <ul className="divide-y divide-divider">
                {items.map(item => {
                  const ts =
                    item.createdAt instanceof Date
                      ? item.createdAt
                      : new Date(item.createdAt);
                  const isUrgent =
                    item.urgency === "blocking_others" || item.urgency === "today";
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="block px-4 py-3 text-[13px] transition-colors hover:bg-divider"
                      >
                        <div className="flex items-start gap-2">
                          {isUrgent ? (
                            <span
                              aria-hidden
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-warning-fg,oklch(70%_0.13_70))]"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-surface-deep"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-ink">
                              {item.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-subtle">
                              {item.meta}
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] text-subtle/80">
                            {relativeTime(ts)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            href="/inbox"
            className="border-t border-border-default px-4 py-2.5 text-center text-[12px] font-medium text-primary underline-offset-2 hover:underline"
          >
            View all in Inbox →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
