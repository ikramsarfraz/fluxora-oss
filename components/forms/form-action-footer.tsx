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
   * When true, the footer sticks to the bottom of the viewport so the
   * save/cancel buttons stay visible while scrolling long forms.
   *
   * Caller must also pass `overflow-visible` to the wrapping Card —
   * shadcn's default Card sets `overflow-hidden`, which clips sticky
   * descendants and silently breaks the stick behaviour.
   */
  sticky?: boolean;
}) {
  return (
    <CardFooter
      className={cn(
        "flex items-center justify-end gap-2 border-t pt-6",
        props.sticky && "sticky bottom-0 z-10 bg-card",
      )}
    >
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
    </CardFooter>
  );
}
