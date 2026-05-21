import { Suspense } from "react";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getInboxData } from "@/modules/distribution/inbox/services/inbox";
import { InboxShell } from "@/modules/distribution/inbox/components/inbox-shell";
import { INBOX_FEATURE } from "@/modules/distribution/inbox";
import { requireFeature } from "@/modules/core/feature-flags";
import { getCurrentTenantCached } from "@/modules/core/tenants/services/tenants";
import { Skeleton } from "@/components/loading/Skeleton";

async function InboxContent() {
  const tenant = await getCurrentTenantCached();
  await requireFeature(tenant.id, INBOX_FEATURE);
  const [portalUser, data] = await Promise.all([
    getCurrentPortalUser(),
    getInboxData(),
  ]);

  const fullName = portalUser.fullName || portalUser.email || "there";
  const firstName = fullName.split(" ")[0];

  return <InboxShell data={data} firstName={firstName} />;
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col">
      <div style={{ marginBottom: 22 }}>
        <Skeleton width={260} height={32} borderRadius={6} style={{ marginBottom: 8 }} />
        <Skeleton width={320} height={16} borderRadius={4} />
      </div>
      <div style={{ height: 80, background: "var(--color-divider)", borderRadius: 14, marginBottom: 22 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 22 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: 76, background: "var(--color-card)", border: "1px solid #e7e7ea", borderRadius: 10 }} />
        ))}
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}
