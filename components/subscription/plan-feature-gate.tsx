import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlanFeatureGateProps = {
  enabled: boolean;
  featureName: string;
  children: ReactNode;
  description?: string;
  requiredPlanLabel?: string;
  upgradeHref?: string;
};

export function PlanFeatureGate({
  enabled,
  featureName,
  children,
  description,
  requiredPlanLabel = "a higher plan",
  upgradeHref = "/account/billing",
}: PlanFeatureGateProps) {
  if (enabled) {
    return <>{children}</>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" />
          {featureName} is not included in this plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {description ??
            `Upgrade to ${requiredPlanLabel} to unlock ${featureName.toLowerCase()}.`}
        </p>
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link href={upgradeHref}>View billing plans</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            This is a UI-only gate for now. No redirects or backend enforcement are applied yet.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
