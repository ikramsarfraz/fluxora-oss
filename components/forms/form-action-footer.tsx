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
   * When true, the footer is pinned to the bottom of the viewport using
   * position:fixed — Save/Cancel are visible from the moment the page
   * loads, regardless of scroll position or form length. Offsets for the
   * shadcn app sidebar via the `--sidebar-width` CSS variable that the
   * SidebarProvider exposes on its root wrapper.
   *
   * On mobile the sidebar is off-canvas and the bar spans the full width.
   * Caller should render this OUTSIDE the wrapping Card (as a sibling),
   * since the Card's overflow-hidden would otherwise establish a
   * containing block for fixed descendants.
   *
   * When false (default), the footer renders as a CardFooter inside the
   * form Card — used by modal embedments where the dialog already
   * manages footer placement.
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
      <>
        {/* Spacer in normal flow so the form content can scroll above the
            fixed bar without the last fields disappearing behind it. */}
        <div aria-hidden className="h-16" />
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-30",
            "border-t border-border-soft bg-card/95 backdrop-blur",
            "shadow-[0_-2px_8px_-4px_rgba(15,23,42,0.06)]",
            "md:left-(--sidebar-width)",
          )}
        >
          <div className="flex items-center justify-end gap-2 px-4 py-3 lg:px-6">
            {buttons}
          </div>
        </div>
      </>
    );
  }

  return (
    <CardFooter className="flex items-center justify-end gap-2 border-t pt-6">
      {buttons}
    </CardFooter>
  );
}
