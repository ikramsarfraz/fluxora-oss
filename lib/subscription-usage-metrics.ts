export type SubscriptionUsageMetric = {
  current: number;
  limit: number;
};

export type SubscriptionUsageState = "normal" | "warning" | "at_limit";

export function formatUsageLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : "Unlimited";
}

export function getUsagePercent(
  metric: SubscriptionUsageMetric,
): number | null {
  if (!Number.isFinite(metric.limit) || metric.limit <= 0) {
    return null;
  }

  return (metric.current / metric.limit) * 100;
}

export function getUsageState(
  metric: SubscriptionUsageMetric,
): SubscriptionUsageState {
  if (!Number.isFinite(metric.limit) || metric.limit <= 0) {
    return "normal";
  }

  if (metric.current >= metric.limit) {
    return "at_limit";
  }

  if (metric.current / metric.limit >= 0.8) {
    return "warning";
  }

  return "normal";
}
