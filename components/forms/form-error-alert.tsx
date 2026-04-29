import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export function FormErrorAlert(props: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle />
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription>{props.children}</AlertDescription>
    </Alert>
  );
}
