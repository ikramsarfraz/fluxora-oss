import {
  ClipboardList,
  CircleDollarSign,
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
    body: "The customer name shows on invoices, AR aging, and order history. Invoice prefix is the short code stamped on every invoice number (ACME-001) so route drivers and AP teams can pick the right one in a hurry. Has to be unique per workspace — hit Generate to get an available one.",
  },
  {
    icon: MailOpen,
    title: "Contact",
    body: "Email is where invoices and statements get delivered when you turn that on. Phone is what dispatch dials when a delivery window slips.",
  },
  {
    icon: CircleDollarSign,
    title: "Payment terms",
    body: "Net N drives the AR aging buckets — an invoice dated Mar 1 with Net 30 first shows up as overdue on Mar 31. Leave blank for Due-on-receipt.",
  },
  {
    icon: ReceiptText,
    title: "Tax ID (EIN)",
    body: "Required if this customer asks for it on B2B invoices, or to match against a 1099-K filing. Masked on customer-facing exports.",
  },
  {
    icon: ClipboardList,
    title: "Fuel surcharge",
    body: "A flat per-order amount auto-added when you tick &lsquo;Add fuel surcharge&rsquo; on a new sales order. Set 0 (or leave blank) to skip.",
  },
  {
    icon: MapPin,
    title: "Addresses",
    body: "Shipping address is what drivers route to; billing address is what shows on invoices; warehouse for receiving teams. The default one auto-fills new orders.",
  },
];

/**
 * Sidebar shown next to the add/edit customer form on lg+ screens. Mirrors
 * SupplierFormSidePanel — fills the right-hand whitespace and gives
 * first-time users concrete answers to "what does this field actually do?".
 */
export function CustomerFormSidePanel() {
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
        <h3 className="text-sm font-semibold text-ink">
          Only name and invoice prefix are required
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-subtle">
          You can save a customer with just those two and fill the rest in
          later. Everything else — including all addresses — is optional and
          can be added when you have it.
        </p>
      </Card>
    </aside>
  );
}
