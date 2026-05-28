"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updatePlatformUserAction } from "@/modules/core/platform-admin/platform-users/actions";

type Role = "platform_admin" | "support" | "qa";

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "platform_admin", label: "Platform admin" },
  { value: "support", label: "Support" },
  { value: "qa", label: "QA" },
];

export function EditPlatformUserDialog({
  id,
  initialRole,
  initialIsActive,
  isSelf,
  label,
}: {
  id: string;
  initialRole: Role;
  initialIsActive: boolean;
  isSelf: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(initialRole);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setRole(initialRole);
    setIsActive(initialIsActive);
  }

  const noChange = role === initialRole && isActive === initialIsActive;

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit platform user</DialogTitle>
          <DialogDescription>
            Change role or deactivate access for {label}. Deactivating prevents
            future sign-ins on the admin host without removing the underlying
            account.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            startTransition(async () => {
              const result = await updatePlatformUserAction({
                id,
                role,
                isActive,
              });
              if (result.ok) {
                toast.success("Platform user updated");
                setOpen(false);
              } else {
                toast.error(result.message);
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-platform-user-role">Role</Label>
            <Select
              value={role}
              onValueChange={v => setRole(v as Role)}
              disabled={isSelf && initialRole === "platform_admin"}
            >
              <SelectTrigger id="edit-platform-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSelf && initialRole === "platform_admin" ? (
              <p className="text-xs text-muted-foreground">
                You can&apos;t demote your own platform_admin role.
              </p>
            ) : null}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="edit-platform-user-active"
              checked={isActive}
              onCheckedChange={v => setIsActive(v === true)}
              disabled={isSelf}
            />
            <div className="grid gap-1">
              <Label htmlFor="edit-platform-user-active" className="font-normal">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                {isSelf
                  ? "You can't deactivate your own account."
                  : "Inactive accounts cannot sign in on the admin host."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || noChange}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
