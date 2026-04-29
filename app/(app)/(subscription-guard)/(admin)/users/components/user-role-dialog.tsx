"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSetUserRole } from "@/hooks/use-users";
import {
  PERMISSION_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_ORDER,
  permissionsForRole,
  type PortalUserRole,
} from "@/lib/auth/permissions";
import type { PortalUserDetail } from "@/services/portal-users";

type UserRoleDialogProps = {
  user: PortalUserDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRole: PortalUserRole | null;
};

/**
 * Inner form. Rendered only when the dialog is open so state resets on each
 * open (avoids `setState` in `useEffect` patterns).
 */
function RoleForm({
  user,
  onOpenChange,
  currentRole,
}: Omit<UserRoleDialogProps, "open">) {
  const [role, setRole] = useState<PortalUserRole>(
    user.role as PortalUserRole,
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useSetUserRole();

  const canAssignOwner = currentRole === "owner";
  const assignableRoles = ROLE_ORDER.filter(
    r => r !== "owner" || canAssignOwner,
  );

  const selectedPerms = permissionsForRole(role);

  const handleSave = () => {
    setError(null);
    if (role === user.role) {
      onOpenChange(false);
      return;
    }
    mutation.mutate(
      { id: user.id, role },
      {
        onSuccess: () => {
          toast.success(`Role updated to ${role}.`);
          onOpenChange(false);
        },
        onError: (e: Error) => setError(e.message),
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change role</DialogTitle>
        <DialogDescription>
          Set the portal role for{" "}
          <span className="font-medium text-foreground">{user.fullName}</span>.
          The role determines what areas of the ERP they can access.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="user-role-select">Role</FieldLabel>
          <Select
            value={role}
            onValueChange={v => setRole(v as PortalUserRole)}
          >
            <SelectTrigger id="user-role-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {assignableRoles.map(r => (
                <SelectItem key={r} value={r}>
                  <span className="capitalize">{r}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{ROLE_DESCRIPTIONS[role]}</FieldDescription>
        </Field>

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Permissions granted
          </p>
          {selectedPerms.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No permissions.
            </p>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {selectedPerms.map(p => (
                <li
                  key={p}
                  className="text-sm text-muted-foreground before:mr-2 before:content-['•']"
                >
                  {PERMISSION_LABELS[p]}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <FormErrorAlert title="We couldn't update the role.">
            {error}
          </FormErrorAlert>
        )}
      </FieldGroup>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={mutation.isPending || role === user.role}
          onClick={handleSave}
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function UserRoleDialog({
  user,
  open,
  onOpenChange,
  currentRole,
}: UserRoleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <RoleForm
            user={user}
            onOpenChange={onOpenChange}
            currentRole={currentRole}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
