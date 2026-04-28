import { AccountProfileTabNav } from "@/components/account/account-profile-tab-nav";

export default function AccountSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <AccountProfileTabNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
