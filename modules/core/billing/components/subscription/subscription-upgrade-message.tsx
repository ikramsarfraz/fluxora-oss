import Link from "next/link";

export function SubscriptionUpgradeMessage(props: {
  message: string;
  href?: string;
}) {
  return (
    <div className="space-y-2">
      <p>{props.message}</p>
      <Link
        href={props.href ?? "/settings/billing/plan-and-usage#billing-plans"}
        className="font-medium underline underline-offset-4"
      >
        Upgrade plan
      </Link>
    </div>
  );
}
