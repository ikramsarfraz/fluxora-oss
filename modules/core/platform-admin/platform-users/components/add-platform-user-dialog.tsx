"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPlatformUserAction } from "@/modules/core/platform-admin/platform-users/actions";

type Role = "platform_admin" | "support" | "qa";

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "platform_admin", label: "Platform admin" },
  { value: "support", label: "Support" },
  { value: "qa", label: "QA" },
];

export function AddPlatformUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setRole("support");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Add platform user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add platform user</DialogTitle>
          <DialogDescription>
            Grants an existing account access to the admin host. The person must
            already have signed up — once they have, enter their email here to
            grant platform access.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            startTransition(async () => {
              const result = await createPlatformUserAction({ email, role });
              if (result.ok) {
                toast.success("Platform user added");
                setOpen(false);
                reset();
              } else {
                toast.error(result.message);
              }
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="add-platform-user-email">Email</Label>
            <Input
              id="add-platform-user-email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@pelzer.dev"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-platform-user-role">Role</Label>
            <Select value={role} onValueChange={v => setRole(v as Role)}>
              <SelectTrigger id="add-platform-user-role" className="w-full">
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add platform user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
