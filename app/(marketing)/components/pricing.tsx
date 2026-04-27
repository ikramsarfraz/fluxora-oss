import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gridPattern, crossPattern } from "./styles";
import { CheckIcon } from "lucide-react";

const plans = [
  { 
    name: "Starter", 
    price: "$0", 
    period: "forever",
    desc: "Perfect for small teams getting started with distribution management.",
    features: ["Up to 3 users", "100 orders/month", "Basic inventory tracking", "Invoice generation", "Email support"],
    cta: "Get started free",
    popular: false,
    color: "oklch(0.50 0.14 230)"
  },
  { 
    name: "Professional", 
    price: "$79", 
    period: "/user/month",
    desc: "For growing teams that need advanced features and integrations.",
    features: ["Unlimited users", "Unlimited orders", "Lot & expiration tracking", "Advanced reporting", "Email notifications", "API access", "Priority support"],
    cta: "Start free trial",
    popular: true,
    color: "oklch(0.55 0.15 195)"
  },
  { 
    name: "Enterprise", 
    price: "Custom", 
    period: "",
    desc: "For large operations with custom requirements and dedicated support.",
    features: ["Everything in Professional", "Custom integrations", "Dedicated account manager", "SLA guarantees", "On-premise option", "24/7 phone support"],
    cta: "Contact sales",
    popular: false,
    color: "oklch(0.55 0.12 165)"
  },
];

export function Pricing() {
  return (
    <div id="pricing" className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24" style={{ 
      background: `
        radial-gradient(ellipse 90% 70% at 50% 0%, oklch(0.92 0.05 230 / 0.2) 0%, transparent 50%),
        linear-gradient(180deg, oklch(0.975 0.006 230) 0%, oklch(0.99 0.003 230) 50%, oklch(0.975 0.006 230) 100%)
      `
    }}>
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: gridPattern }} />
      <div className="pointer-events-none absolute inset-0 opacity-15" style={{ backgroundImage: crossPattern }} />
      
      <div className="relative mx-auto max-w-[1120px]">
        <div className="mb-10 text-center sm:mb-14">
          <Badge variant="outline" className="mb-3 border-[oklch(0.88_0.04_230)] bg-white px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[oklch(0.40_0.08_230)] sm:text-[0.75rem]">
            <svg className="mr-1.5 size-3 sm:size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Pricing
          </Badge>
          <h2 className="mb-3 text-[1.5rem] font-extrabold leading-[1.15] tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:mb-4 sm:text-[1.8rem] lg:text-[2.2rem]">Simple, transparent pricing.</h2>
          <p className="mx-auto max-w-[520px] text-[0.9rem] leading-[1.7] text-[oklch(0.50_0.02_230)] sm:text-[1rem]">Start free during early access. Choose the plan that fits your operation as you grow.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative flex flex-col overflow-hidden transition-all hover:shadow-lg ${
                plan.popular 
                  ? "border-[oklch(0.55_0.15_195)] ring-2 ring-[oklch(0.55_0.15_195/0.2)]" 
                  : "border-[oklch(0.90_0.02_230)]"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute right-3 top-3 border-0 text-[0.65rem] text-white sm:right-4 sm:top-4 sm:text-xs" style={{ background: "oklch(0.55 0.15 195)" }}>
                  Most Popular
                </Badge>
              )}
              <CardHeader className={`p-5 sm:p-6 ${plan.popular ? "bg-[oklch(0.98_0.01_195)]" : ""}`}>
                <CardTitle className="text-[0.85rem] font-bold text-[oklch(0.25_0.03_230)] sm:text-[0.9rem]">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-[2rem] font-extrabold tracking-[-0.03em] text-[oklch(0.18_0.03_230)] sm:text-[2.5rem]">{plan.price}</span>
                  {plan.period && <span className="text-[0.8rem] text-[oklch(0.55_0.02_230)] sm:text-[0.85rem]">{plan.period}</span>}
                </div>
                <CardDescription className="text-[0.8rem] leading-relaxed sm:text-[0.85rem]">{plan.desc}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col border-t border-[oklch(0.92_0.01_230)] p-5 pt-5 sm:p-6 sm:pt-6">
                <ul className="mb-6 flex-1 space-y-2.5 sm:mb-8 sm:space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[0.8rem] text-[oklch(0.40_0.03_230)] sm:gap-2.5 sm:text-[0.85rem]">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 sm:size-4" style={{ color: plan.color }} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${
                    plan.popular 
                      ? "bg-[oklch(0.35_0.10_230)] text-white hover:bg-[oklch(0.40_0.10_230)]" 
                      : ""
                  }`}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-[0.78rem] text-[oklch(0.55_0.02_230)] sm:mt-8 sm:text-[0.82rem]">All plans include SSL encryption, daily backups, and 99.9% uptime SLA.</p>
      </div>
    </div>
  );
}
