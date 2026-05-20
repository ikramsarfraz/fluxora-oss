import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FormActionFooter(props: {
  formId: string;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
  /**
   * When true, the footer renders as a standalone bar that sticks to the
   * bottom of the page scroll container — keeps Save/Cancel visible on
   * long forms. Callers must render this OUTSIDE the wrapping Card (as a
   * sibling), because shadcn Card sets `overflow-hidden` which silently
   * clips sticky descendants.
   *
   * When false (default), the footer renders as a CardFooter and should
   * sit inside the form Card — used by modal embedments where the dialog
   * already manages footer placement.
   */
  sticky?: boolean;
}) {
  const buttons = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={props.onCancel}
        disabled={props.isPending}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form={props.formId}
        disabled={props.isPending}
      >
        {props.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {props.isPending ? props.pendingLabel : props.submitLabel}
      </Button>
    </>
  );

  if (props.sticky) {
    return (
      <div
        className={cn(
          "sticky bottom-2 z-10 flex items-center justify-end gap-2",
          "rounded-lg border border-border-soft bg-card px-4.5 py-3",
          "shadow-[0_4px_16px_-6px_rgba(15,23,42,0.12)]",
        )}
      >
        {buttons}
      </div>
    );
  }

  return (
    <CardFooter className="flex items-center justify-end gap-2 border-t pt-6">
      {buttons}
    </CardFooter>
  );
}
