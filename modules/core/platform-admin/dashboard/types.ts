import type { getPlatformAdminDashboardData } from "@/modules/core/platform-admin/services/platform-admin";

export type PlatformAdminDashboardData = Awaited<
  ReturnType<typeof getPlatformAdminDashboardData>
>;
