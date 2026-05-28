import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/utils/date";
import { PLATFORM_USERS_ROLES } from "@/modules/core/platform-admin/platform-users/permissions";
import { AddPlatformUserDialog } from "@/modules/core/platform-admin/platform-users/components/add-platform-user-dialog";
import { EditPlatformUserDialog } from "@/modules/core/platform-admin/platform-users/components/edit-platform-user-dialog";
import { PendingInvitationsCard } from "@/modules/core/platform-admin/platform-users/components/pending-invitations-card";
import { listPlatformUserInvitations } from "@/modules/core/platform-admin/platform-users/services/invitations";
import { requirePlatformUserInRoles } from "@/modules/core/platform-admin/services/platform-users";
import {
  countPlatformAdminUsers,
  listPlatformAdminUsers,
  type PlatformAdminUserFilters,
  type PlatformAdminUserRole,
} from "@/modules/core/platform-admin/services/platform-admin";

const PAGE_SIZE = 25;

const PLATFORM_USER_ROLES: readonly PlatformAdminUserRole[] = [
  "platform_admin",
  "support",
  "qa",
];

type SearchParams = {
  q?: string;
  role?: string;
  active?: string;
  page?: string;
};

function readString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function parsePage(raw: string | undefined, totalPages: number): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, totalPages));
}

function roleFilter(raw: string): PlatformAdminUserRole | null {
  return (PLATFORM_USER_ROLES as readonly string[]).includes(raw)
    ? (raw as PlatformAdminUserRole)
    : null;
}

function isActiveFilter(raw: string): "active" | "inactive" | null {
  return raw === "active" || raw === "inactive" ? raw : null;
}

function buildHref(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s.length === 0) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `/admin/platform-users?${qs}` : "/admin/platform-users";
}

export default async function PlatformAdminUsersListPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await props.searchParams;
  const q = readString(params.q);
  const roleRaw = readString(params.role);
  const activeRaw = readString(params.active);

  const filters: PlatformAdminUserFilters = {
    search: q || null,
    role: roleFilter(roleRaw),
    isActive: isActiveFilter(activeRaw),
  };

  const [currentUser, total] = await Promise.all([
    requirePlatformUserInRoles(PLATFORM_USERS_ROLES),
    countPlatformAdminUsers(filters),
  ]);
  const canManage = currentUser.role === "platform_admin";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = parsePage(params.page, totalPages);
  const offset = (page - 1) * PAGE_SIZE;

  const [users, invitations] = await Promise.all([
    listPlatformAdminUsers({
      filters,
      limit: PAGE_SIZE,
      offset,
    }),
    listPlatformUserInvitations(),
  ]);

  const hasFilters = Boolean(q) || Boolean(roleRaw) || Boolean(activeRaw);
  const fromCount = total === 0 ? 0 : offset + 1;
  const toCount = Math.min(offset + users.length, total);

  const baseParams = {
    q: q || null,
    role: roleRaw || null,
    active: activeRaw || null,
  };

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Platform users</CardTitle>
            <CardDescription>
              Internal accounts with access to the reserved admin host.
            </CardDescription>
          </div>
          {canManage ? <AddPlatformUserDialog /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          method="get"
          action="/admin/platform-users"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label
              htmlFor="platform-users-q"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Search
            </label>
            <Input
              id="platform-users-q"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name or email"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="platform-users-role"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Role
            </label>
            <select
              id="platform-users-role"
              name="role"
              defaultValue={roleRaw}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs"
            >
              <option value="">Any</option>
              {PLATFORM_USER_ROLES.map(r => (
                <option key={r} value={r}>
                  {r.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="platform-users-active"
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Status
            </label>
            <select
              id="platform-users-active"
              name="active"
              defaultValue={activeRaw}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm shadow-xs"
            >
              <option value="">Any</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm">
              Apply filters
            </Button>
            {hasFilters ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/platform-users">Clear</Link>
              </Button>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {total === 0
                ? "No platform users match these filters."
                : `Showing ${fromCount.toLocaleString()}–${toCount.toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              {canManage ? <TableHead className="w-[80px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length > 0 ? (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.authUser.name}</TableCell>
                  <TableCell>{user.authUser.email}</TableCell>
                  <TableCell className="capitalize">{user.role.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "secondary" : "outline"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDisplayDate(user.createdAt)}</TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      <EditPlatformUserDialog
                        id={user.id}
                        initialRole={user.role as PlatformAdminUserRole}
                        initialIsActive={user.isActive}
                        isSelf={user.id === currentUser.id}
                        label={user.authUser.name || user.authUser.email}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="text-muted-foreground"
                >
                  {hasFilters
                    ? "No platform users match these filters."
                    : "No platform users yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {totalPages > 1 ? (
          <nav
            aria-label="Platform users pagination"
            className="flex items-center justify-between text-sm text-muted-foreground"
          >
            <span>
              Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={buildHref({
                      ...baseParams,
                      page: page - 1 === 1 ? null : page - 1,
                    })}
                  >
                    ← Previous
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  ← Previous
                </Button>
              )}
              {page < totalPages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={buildHref({ ...baseParams, page: page + 1 })}>
                    Next →
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next →
                </Button>
              )}
            </div>
          </nav>
        ) : null}
      </CardContent>
    </Card>

    <PendingInvitationsCard rows={invitations} canManage={canManage} />
    </div>
  );
}
