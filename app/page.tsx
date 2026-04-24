import Link from "next/link";
import { ArrowRight, Building2, ChartColumn, PackageCheck, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function MarketingHomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_#f8fbff_0%,_#eef5ff_42%,_#ffffff_100%)] px-4 py-6 md:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <header className="flex items-center justify-between gap-4 px-6 py-5 md:px-8">
          <div className="flex items-center gap-2 text-slate-900">
            <div className="flex size-8 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
              <Building2 className="size-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">PrimeERP</span>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
        </header>

        <section className="grid flex-1 gap-10 px-6 py-10 md:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-blue-100">
              Multi-tenant ERP for distribution teams
            </div>
            <div className="max-w-2xl space-y-4">
              <h1 className="text-5xl font-semibold tracking-tight text-slate-950">
                Run orders, receiving, inventory, and billing from one system.
              </h1>
              <p className="text-lg leading-8 text-slate-600">
                PrimeERP gives every business its own tenant subdomain while
                keeping sales, supplier invoices, lots, inventory, invoicing,
                and payments connected in one workflow.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 gap-2">
                <Link href="/signup">
                  Create your tenant
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11">
                <Link href="/features">Explore features</Link>
              </Button>
            </div>
            <div className="grid gap-3 pt-4 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: "Tenant isolated",
                  description: "Every company signs in on its own subdomain.",
                },
                {
                  icon: PackageCheck,
                  title: "Operationally complete",
                  description: "Orders, receiving, lots, and inventory stay connected.",
                },
                {
                  icon: ChartColumn,
                  title: "Finance-ready",
                  description: "Invoices, payments, COGS, and gross margin are built in.",
                },
              ].map(item => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
                >
                  <item.icon className="size-5 text-blue-600" />
                  <p className="mt-3 font-medium text-slate-900">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(239,246,255,0.96))] p-6 shadow-[0_18px_40px_rgba(59,130,246,0.12)]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-sm text-slate-500">Central login</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  `localhost:3000/login`
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Email-first discovery routes users into the correct tenant sign-in
                  flow.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-sm text-slate-500">Tenant login</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">
                  `company.localhost:3000/login`
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Authenticated ERP routes live only on the tenant subdomain and
                  require matching tenant membership.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-sm text-slate-500">Operational stack</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Orders, supplier invoices, lots, inventory, invoices, and
                  payments are all already wired into the tenant app.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
