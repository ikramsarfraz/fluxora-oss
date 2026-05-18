"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { RolesPermissionsCard } from "@/modules/core/workspace-settings/components/tenant-admin/roles-permissions-card";
import Users from "@/modules/core/workspace-settings/users/components/users-page";
import type { PortalUserRole } from "@/lib/auth/permissions";

const TABS = [
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles & Permissions" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function UserManagementTabs({
  currentUserRole,
}: {
  currentUserRole: PortalUserRole;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/user-management";

  const activeTab = (searchParams.get("tab") as Tab | null) ?? "users";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="User Management"
        description="Manage team members, invitations, and access permissions."
      />
      <nav className="flex gap-1 border-b border-border" aria-label="User management sections">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px inline-flex border-b-2 px-4 py-3 text-sm font-medium transition-colors outline-none",
              activeTab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {activeTab === "users" && <Users />}
      {activeTab === "roles" && <RolesPermissionsCard highlightRole={currentUserRole} />}
    </div>
  );
}
