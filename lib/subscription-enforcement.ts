import type {
  SubscriptionFeatureKey,
  SubscriptionLimitKey,
} from "@/lib/subscription-plan-capabilities";
import { formatSubscriptionPlanLabel } from "@/lib/subscription-display";
import type {
  TenantSubscriptionPlan,
  TenantSubscriptionStatus,
} from "@/lib/tenant-subscription";

const SUBSCRIPTION_ENFORCEMENT_PREFIX = "[SUBSCRIPTION_ENFORCEMENT";

export type SubscriptionEnforcementReason =
  | "feature_required"
  | "limit_reached";

export type SubscriptionEnforcementMeta = {
  reason: SubscriptionEnforcementReason;
  key: SubscriptionFeatureKey | SubscriptionLimitKey;
};

export type SubscriptionPlanContext = {
  id?: string;
  slug?: string | null;
  subscriptionPlan: TenantSubscriptionPlan;
  subscriptionStatus?: TenantSubscriptionStatus | null | undefined;
};

function formatPrefixedMessage(
  meta: SubscriptionEnforcementMeta,
  message: string,
): string {
  return `${SUBSCRIPTION_ENFORCEMENT_PREFIX}:${meta.reason}:${meta.key}] ${message}`;
}

export function parseSubscriptionEnforcementMessage(
  message: string,
): (SubscriptionEnforcementMeta & { userMessage: string }) | null {
  const match = /^\[SUBSCRIPTION_ENFORCEMENT:([^:\]]+):([^\]]+)\]\s*(.*)$/u.exec(
    message.trim(),
  );
  if (!match) {
    return null;
  }

  const [, reason, key, userMessage] = match;
  if (reason !== "feature_required" && reason !== "limit_reached") {
    return null;
  }

  return {
    reason,
    key: key as SubscriptionFeatureKey | SubscriptionLimitKey,
    userMessage,
  };
}

export function stripSubscriptionEnforcementPrefix(message: string): string {
  return parseSubscriptionEnforcementMessage(message)?.userMessage ?? message;
}

export function isLimitReachedMessage(
  message: string,
  limitKey?: SubscriptionLimitKey,
): boolean {
  const parsed = parseSubscriptionEnforcementMessage(message);
  return (
    parsed?.reason === "limit_reached" &&
    (limitKey === undefined || parsed.key === limitKey)
  );
}

export function isFeatureRequiredMessage(
  message: string,
  featureKey?: SubscriptionFeatureKey,
): boolean {
  const parsed = parseSubscriptionEnforcementMessage(message);
  return (
    parsed?.reason === "feature_required" &&
    (featureKey === undefined || parsed.key === featureKey)
  );
}

export function createPlanLimitReachedError(args: {
  tenant: SubscriptionPlanContext;
  limitKey: SubscriptionLimitKey;
  limit: number;
  resourceLabel: string;
  actionLabel?: string;
}): Error {
  const planLabel = formatSubscriptionPlanLabel(args.tenant.subscriptionPlan);
  const action = args.actionLabel ?? `add another ${args.resourceLabel}`;
  return new Error(
    formatPrefixedMessage(
      {
        reason: "limit_reached",
        key: args.limitKey,
      },
      `Your current plan (${planLabel}) allows up to ${args.limit} ${args.resourceLabel}. Upgrade your plan to ${action}.`,
    ),
  );
}

export function createFeatureUnavailableError(args: {
  featureKey: SubscriptionFeatureKey;
  currentPlan: TenantSubscriptionPlan;
  requiredPlan?: TenantSubscriptionPlan;
}): Error {
  const requiredPlanLabel = args.requiredPlan
    ? `${formatSubscriptionPlanLabel(args.requiredPlan)} or higher`
    : "a higher plan";
  return new Error(
    formatPrefixedMessage(
      {
        reason: "feature_required",
        key: args.featureKey,
      },
      `This feature is not available on the ${formatSubscriptionPlanLabel(
        args.currentPlan,
      )} plan. It requires ${requiredPlanLabel}.`,
    ),
  );
}

export function logSubscriptionEnforcementBlock(args: {
  tenant: SubscriptionPlanContext;
  reason: SubscriptionEnforcementReason;
  key: SubscriptionFeatureKey | SubscriptionLimitKey;
  limit?: number;
}): void {
  console.warn("[subscription enforcement] blocked", {
    tenantId: args.tenant.id ?? null,
    tenantSlug: args.tenant.slug ?? null,
    subscriptionPlan: args.tenant.subscriptionPlan,
    subscriptionStatus: args.tenant.subscriptionStatus ?? null,
    reason: args.reason,
    key: args.key,
    limit: args.limit ?? null,
  });
}
