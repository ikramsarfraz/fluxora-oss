import Link from "next/link";
import {
  Box,
  CircleDollarSign,
  ClipboardList,
  Layers,
  Ruler,
  Tag,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";

type SectionExplainer = {
  icon: LucideIcon;
  title: string;
  body: string;
};

// Curly quotes/apostrophes used directly so JSX renders them correctly
// without needing dangerouslySetInnerHTML.
const SECTIONS: ReadonlyArray<SectionExplainer> = [
  {
    icon: Tag,
    title: "Name & SKU",
    body: "The product name shows in orders, invoices, picking lists, and the price chart. SKU auto-generates from the name + category on create — you can’t edit it later, so plan for it to stay readable.",
  },
  {
    icon: ClipboardList,
    title: "Categories",
    body: "Drive grouping on the products list, the price chart, and supplier-comparison reports. A product can belong to multiple categories (e.g. “Beef” and “Halal”).",
  },
  {
    icon: Ruler,
    title: "Base unit",
    body: "The atomic unit pricing, costs, and inventory are tracked in. Pick lb for catch-weight meat, ea for cans/packaged items, gal/L for liquids. Locked once the product has any bills against it.",
  },
  {
    icon: CircleDollarSign,
    title: "Default price",
    body: "The starting price the order form suggests when a customer has no contracted price. Stored in the base unit — case prices are derived using the conversion below.",
  },
  {
    icon: Layers,
    title: "Sales units",
    body: "The unit options staff see when adding this product to an order. Add a row for each way you quote — most products only need one matching the base unit; add a case row with its conversion if you sell whole packs.",
  },
  {
    icon: Box,
    title: "Default & Fractional",
    body: "“Default” picks the unit preselected on new orders. “Fractional” allows decimal quantities — leave OFF for fixed packs (cases, boxes) where a half doesn’t make sense.",
  },
];

/**
 * Sidebar shown next to the add/edit product form on lg+ screens. Mirrors
 * the customer + supplier side panels — fills the right-hand whitespace
 * with concrete answers to "what does this field actually do?" and where
 * the value shows up downstream. Sticky on lg+ so the explainer follows
 * the user as they scroll through a tall form.
 */
export function ProductFormSidePanel() {
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
          Need a unit that isn’t in the list?
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-subtle">
          Add it from the{" "}
          <Link
            href="/units-of-measure"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            units of measure
          </Link>{" "}
          admin and it’ll appear in the base-unit and sales-unit pickers,
          grouped by family.
        </p>
      </Card>
    </aside>
  );
}
