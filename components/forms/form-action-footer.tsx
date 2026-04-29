import { Loader2 } from "lucide-react";

import { CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FormActionFooter(props: {
  formId: string;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}) {
  return (
    <CardFooter className="flex items-center justify-end gap-2 border-t pt-6">
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
