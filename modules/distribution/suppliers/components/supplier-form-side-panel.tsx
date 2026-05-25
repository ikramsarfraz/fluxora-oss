import {
  CircleDollarSign,
  ClipboardList,
  IdCard,
  MailOpen,
  MapPin,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";

type SectionExplainer = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const SECTIONS: ReadonlyArray<SectionExplainer> = [
  {
    icon: IdCard,
    title: "Identity",
    body: "The supplier name shows up everywhere — invoice records, AP aging, lot history. Account number auto-fills on new bills so the AI parser doesn't ask twice.",
  },
  {
    icon: MailOpen,
    title: "Primary contact",
    body: "Surfaced on the supplier detail page and on AP-chase emails. The person you actually call when an invoice is missing or wrong.",
  },
  {
    icon: MapPin,
    title: "Remit-to address",
    body: "Where you mail checks or returns. Pulled into printed check stubs and the supplier audit log.",
  },
  {
    icon: CircleDollarSign,
    title: "Payment terms",
    body: "Net N drives the AP aging buckets — a bill dated Mar 1 with Net 30 first shows up as overdue on Mar 31.",
  },
  {
    icon: ReceiptText,
    title: "Tax ID (EIN)",
    body: "Required to issue this supplier a 1099-NEC at year end. Masked on receipts and supplier exports.",
  },
  {
    icon: ClipboardList,
    title: "Notes",
    body: "Free-text memo visible only to your workspace — delivery quirks, after-hours numbers, anything ops should remember.",
  },
];

/**
 * Sidebar shown next to the add/edit supplier form on lg+ screens. Covers
 * the previously empty right-hand whitespace and gives first-time users
 * concrete answers to "what does this field actually do?".
 */
export function SupplierFormSidePanel() {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:h-fit">
      <Card className="overflow-hidden p-5 shadow-none">
        <header>
          <h3 className="text-sm font-semibold text-ink">Why we ask</h3>
          <p className="mt-1 text-xs text-subtle">
            A quick map of where each field shows up downstream.
          </p>
        </header>
        <dl className="mt-4 space-y-4">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-medium text-ink">{title}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-subtle">
                  {body}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="overflow-hidden p-5 shadow-none">
        <h3 className="text-sm font-semibold text-ink">Only the name is required</h3>
        <p className="mt-1 text-xs leading-relaxed text-subtle">
          You can save a supplier with just a name and fill the rest in later.
          Every field except <em>Supplier name</em> is optional — handy when
          you&apos;re creating a placeholder from a bill review and don&apos;t
          have full details yet.
        </p>
      </Card>
    </aside>
  );
}
