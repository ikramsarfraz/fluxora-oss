"use client";

import { Check, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_ORDER,
  permissionsForRole,
  type Permission,
  type PortalUserRole,
} from "@/lib/auth/permissions";

type Props = {
  title?: string;
  description?: string;
  highlightRole?: PortalUserRole | null;
};

export function RolesPermissionsCard({
  title = "Roles and permissions",
  description = "Reference matrix of what each role can do in the ERP.",
  highlightRole = null,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {ROLE_ORDER.map(r => (
            <div
              key={r}
              className={
                "rounded-md border p-3 " +
                (highlightRole === r ? "border-primary bg-primary/5" : "")
              }
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal capitalize">
                  {r}
                </Badge>
                {highlightRole === r ? (
                  <span className="text-xs text-primary">Current role</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[r]}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>Permission</TableHead>
                {ROLE_ORDER.map(r => (
                  <TableHead
                    key={r}
                    className="text-center text-xs font-medium uppercase tracking-wider"
                  >
                    {r}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_PERMISSIONS.map(p => (
                <PermissionRow key={p} permission={p} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionRow({ permission }: { permission: Permission }) {
  return (
    <TableRow>
      <TableCell className="text-sm">{PERMISSION_LABELS[permission]}</TableCell>
      {ROLE_ORDER.map(r => {
        const has = permissionsForRole(r).includes(permission);
        return (
          <TableCell key={r} className="text-center">
            {has ? (
              <Check
                className="mx-auto size-4 text-green-700"
                aria-label="Allowed"
              />
            ) : (
              <Minus
                className="mx-auto size-4 text-muted-foreground/40"
                aria-label="Not allowed"
              />
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
