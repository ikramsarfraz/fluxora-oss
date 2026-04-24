import Link from "next/link";
import { ArrowLeft, Boxes, FileText, Receipt, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600">PrimeERP features</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              Core workflows already running in the tenant app
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Back home
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: FileText,
              title: "Sales order workflow",
              description:
                "Create, fulfill, short-ship, invoice, and record payments from one tenant-aware lifecycle screen.",
            },
            {
              icon: Receipt,
              title: "Supplier receiving",
              description:
                "Capture supplier invoices, lot receipts, attachments, and per-case weights with audit history.",
            },
            {
              icon: Boxes,
              title: "Inventory + lot traceability",
              description:
                "Inspect inventory, allocations, lots, expiration state, and warehouse lifecycle status.",
            },
            {
              icon: Truck,
              title: "Operational ERP foundation",
              description:
                "Tenant auth, role-aware screens, inventory cost snapshots, COGS, and gross margin are already in place.",
            },
          ].map(item => (
            <div
              key={item.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <item.icon className="size-6 text-blue-600" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
