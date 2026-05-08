import type { getPlatformAdminDashboardData } from "@/services/platform-admin";

export type PlatformAdminDashboardData = Awaited<
  ReturnType<typeof getPlatformAdminDashboardData>
>;
