import { Suspense } from "react";
import { getCurrentPortalUser } from "@/modules/shared/services/portal-users";
import { getInboxData } from "@/modules/distribution/inbox/services/inbox";
import { InboxShell } from "@/modules/distribution/inbox/components/inbox-shell";
import { Skeleton } from "@/components/loading/Skeleton";

async function InboxContent() {
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
    <div style={{ padding: "28px 32px", maxWidth: 1440, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Skeleton width={260} height={32} borderRadius={6} style={{ marginBottom: 8 }} />
        <Skeleton width={320} height={16} borderRadius={4} />
      </div>
      <div style={{ height: 80, background: "#f4f4f5", borderRadius: 14, marginBottom: 22 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 22 }}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: 76, background: "#fff", border: "1px solid #e7e7ea", borderRadius: 10 }} />
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
