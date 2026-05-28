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
import { cn } from "@/lib/utils";
import {
  createPlatformUserAction,
  invitePlatformUserAction,
} from "@/modules/core/platform-admin/platform-users/actions";

type Role = "platform_admin" | "support" | "qa";

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "platform_admin", label: "Platform admin" },
  { value: "support", label: "Support" },
  { value: "qa", label: "QA" },
];

type Mode = "invite" | "promote";

export function AddPlatformUserDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("invite");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("support");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setMode("invite");
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
            {mode === "invite"
              ? "Send an email invitation that lets the recipient sign in for the first time and claim platform access."
              : "Grant platform access to someone who has already signed up to Fluxora — no email is sent."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-md border border-border-default bg-surface p-1 text-sm">
          <ModeButton
            current={mode}
            value="invite"
            onClick={setMode}
            label="Invite by email"
          />
          <ModeButton
            current={mode}
            value="promote"
            onClick={setMode}
            label="Promote existing"
          />
        </div>

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            startTransition(async () => {
              const result =
                mode === "invite"
                  ? await invitePlatformUserAction({ email, role })
                  : await createPlatformUserAction({ email, role });
              if (result.ok) {
                toast.success(
                  mode === "invite"
                    ? `Invitation sent to ${email}`
                    : "Platform user added",
                );
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
            {mode === "promote" ? (
              <p className="text-xs text-muted-foreground">
                The person must already have a Fluxora account. If they
                don&apos;t, use &ldquo;Invite by email&rdquo; instead.
              </p>
            ) : null}
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
              {isPending
                ? mode === "invite"
                  ? "Sending…"
                  : "Adding…"
                : mode === "invite"
                  ? "Send invitation"
                  : "Add platform user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  value,
  current,
  onClick,
  label,
}: {
  value: Mode;
  current: Mode;
  onClick: (mode: Mode) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
        value === current
          ? "bg-card text-ink shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
