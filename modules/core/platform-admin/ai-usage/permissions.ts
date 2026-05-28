// AI cost dashboard is visible to every platform role — support uses it
// to investigate tenant spikes, QA uses it to verify parse pipelines
// after deploys.
export const PLATFORM_AI_USAGE_ROLES = [
  "platform_admin",
  "support",
  "qa",
] as const;
export type PlatformAiUsageRole = (typeof PLATFORM_AI_USAGE_ROLES)[number];
