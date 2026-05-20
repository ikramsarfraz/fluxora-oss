import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  ArchiveRestore,
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  Clock,
  CreditCard,
  Crown,
  FileCheck2,
  FileText,
  FlaskConical,
  GitBranch,
  Globe,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Link2,
  Mail,
  MailPlus,
  Newspaper,
  Package,
  PaintBucket,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tags,
  Timer,
  Truck,
  UploadCloud,
  UserPlus,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";

export type FeatureAccent = "forest" | "success" | "warning" | "info";

export type FeatureGroup =
  | "auth"
  | "tenancy"
  | "billing"
  | "distribution"
  | "ops";

export type Feature = {
  /** URL slug under /reel/<slug>. Stable, lowercase, hyphenated. */
  slug: string;
  /** 1-based index matching docs/feature-flows.md section number. */
  index: number;
  group: FeatureGroup;
  /** Short uppercase chip rendered above the title. */
  eyebrow: string;
  /** Human display name. */
  title: string;
  /** Three lines for the serif headline. Third line gets the accent color. */
  headline: [string, string, string];
  /** 1–2 sentence body copy. */
  body: string;
  /** Three short proof points rendered as icon pills. */
  highlights: { icon: LucideIcon; label: string }[];
  /** Accent palette key. */
  accent: FeatureAccent;
  /** Icon used in the brand chip and in the index grid card. */
  icon: LucideIcon;
  /** Optional URL the CTA should link to instead of /signup. */
  liveDemoHref?: string;
};

export const GROUP_LABEL: Record<FeatureGroup, string> = {
  auth: "Accounts",
  tenancy: "Workspaces",
  billing: "Billing",
  distribution: "Distribution",
  ops: "Platform & Ops",
};

export const GROUP_ORDER: FeatureGroup[] = [
  "auth",
  "tenancy",
  "billing",
  "distribution",
  "ops",
];

export const FEATURES: Feature[] = [
  // ---------- Accounts ----------
  {
    slug: "signup-login",
    index: 1,
    group: "auth",
    eyebrow: "Sign in",
    title: "Signup, Login, Magic Links",
    headline: ["No passwords to lose.", "No forms to fill.", "Just sign in."],
    body:
      "Email, password, or one-tap magic link — Fluxora's auth flow gets you into the right workspace without the friction of resets and recovery codes.",
    highlights: [
      { icon: Mail, label: "Magic links" },
      { icon: KeyRound, label: "Email + password" },
      { icon: ShieldCheck, label: "Verified by default" },
    ],
    accent: "forest",
    icon: KeyRound,
  },
  {
    slug: "google-oauth",
    index: 2,
    group: "auth",
    eyebrow: "Single sign-on",
    title: "Sign in with Google",
    headline: ["One click.", "One identity.", "Across every workspace."],
    body:
      "Bring your Google account and we'll route you into the right tenant. Same email, same identity — anywhere in Fluxora.",
    highlights: [
      { icon: Globe, label: "Google OAuth" },
      { icon: BadgeCheck, label: "Account linking" },
      { icon: ShieldCheck, label: "Tenant-aware" },
    ],
    accent: "forest",
    icon: Globe,
  },
  {
    slug: "onboarding",
    index: 3,
    group: "tenancy",
    eyebrow: "Get started",
    title: "Onboarding & Tenant Chooser",
    headline: [
      "From zero",
      "to your first workspace —",
      "in under two minutes.",
    ],
    body:
      "Pick a subdomain, name your workspace, invite your team. If you belong to many, the chooser drops you exactly where you left off.",
    highlights: [
      { icon: Building2, label: "Workspace setup" },
      { icon: Workflow, label: "Tenant chooser" },
      { icon: UserPlus, label: "Invite during setup" },
    ],
    accent: "info",
    icon: Building2,
  },
  {
    slug: "multi-tenant-routing",
    index: 4,
    group: "tenancy",
    eyebrow: "Architecture",
    title: "Multi-tenant Subdomain Routing",
    headline: [
      "One platform.",
      "Every workspace",
      "on its own subdomain.",
    ],
    body:
      "acme.fluxora.app, beta.fluxora.app, you-name-it.fluxora.app — each tenant gets a clean URL, isolated data, and its own brand at the top.",
    highlights: [
      { icon: Globe, label: "Subdomain per tenant" },
      { icon: ShieldCheck, label: "Header-stripped routing" },
      { icon: Workflow, label: "Reserved admin host" },
    ],
    accent: "info",
    icon: Globe,
  },
  {
    slug: "invitations",
    index: 5,
    group: "tenancy",
    eyebrow: "Team",
    title: "Invitations",
    headline: ["Send an email.", "They click once.", "They're in."],
    body:
      "Invite teammates by email with a role pre-assigned. Tokens expire, links are single-use, and signed-in users land straight on the right workspace.",
    highlights: [
      { icon: MailPlus, label: "Email invites" },
      { icon: Timer, label: "Expiring tokens" },
      { icon: ShieldCheck, label: "Role-pre-assigned" },
    ],
    accent: "info",
    icon: MailPlus,
  },
  {
    slug: "roles-permissions",
    index: 6,
    group: "tenancy",
    eyebrow: "Access",
    title: "Roles & Permissions",
    headline: [
      "Owner, admin, member —",
      "and the warehouse crew",
      "sees only what they need.",
    ],
    body:
      "Fine-grained roles map to real-world job functions. Permissions are enforced server-side, all the way down to the row.",
    highlights: [
      { icon: Crown, label: "Owner & admin" },
      { icon: Users, label: "Custom roles" },
      { icon: ShieldCheck, label: "Server-enforced" },
    ],
    accent: "forest",
    icon: ShieldCheck,
  },

  // ---------- Billing ----------
  {
    slug: "stripe-checkout",
    index: 7,
    group: "billing",
    eyebrow: "Subscribe",
    title: "Stripe Checkout",
    headline: ["Pick a plan.", "Pay.", "You're on."],
    body:
      "Stripe-hosted Checkout means PCI is their problem. You pick Starter, Growth, or Enterprise and we wire the rest in the background.",
    highlights: [
      { icon: CreditCard, label: "Stripe-hosted" },
      { icon: ShieldCheck, label: "PCI-compliant" },
      { icon: Repeat, label: "Auto-renew" },
    ],
    accent: "warning",
    icon: CreditCard,
  },
  {
    slug: "stripe-portal",
    index: 8,
    group: "billing",
    eyebrow: "Self-serve",
    title: "Stripe Customer Portal",
    headline: [
      "Cards, invoices,",
      "cancellation —",
      "all without an email to support.",
    ],
    body:
      "Owners hit the portal from Account → Billing. Update payment, download invoices, cancel without anyone in the loop.",
    highlights: [
      { icon: Wallet, label: "Payment methods" },
      { icon: FileText, label: "Past invoices" },
      { icon: AlertCircle, label: "One-click cancel" },
    ],
    accent: "warning",
    icon: Wallet,
  },
  {
    slug: "stripe-webhook",
    index: 9,
    group: "billing",
    eyebrow: "Sync",
    title: "Stripe Webhook",
    headline: [
      "Plan changes in Stripe.",
      "Status changes here.",
      "Always in sync.",
    ],
    body:
      "Every subscription event Stripe emits — created, updated, paused, canceled — is verified, stored, and reflected in the workspace within seconds.",
    highlights: [
      { icon: Activity, label: "Signature verified" },
      { icon: GitBranch, label: "Idempotent" },
      { icon: Timer, label: "Sub-second updates" },
    ],
    accent: "warning",
    icon: Activity,
  },
  {
    slug: "plan-capabilities",
    index: 10,
    group: "billing",
    eyebrow: "Plans",
    title: "Plan capabilities & enforcement",
    headline: [
      "Plans that grow",
      "with your team —",
      "limits that hold the line.",
    ],
    body:
      "Each plan ships with feature gates and numeric ceilings. Hit a limit and we'll nudge you to upgrade before the workflow breaks.",
    highlights: [
      { icon: ShieldCheck, label: "Server-enforced" },
      { icon: LineChart, label: "Soft & hard limits" },
      { icon: Sparkles, label: "Friendly upgrade prompts" },
    ],
    accent: "warning",
    icon: BarChart3,
  },
  {
    slug: "stripe-catalog-sync",
    index: 11,
    group: "billing",
    eyebrow: "Catalog",
    title: "Stripe catalog sync",
    headline: [
      "Edit prices in Stripe.",
      "We mirror them here.",
      "No config drift.",
    ],
    body:
      "Add a price, tag it with plan metadata, and Fluxora picks it up automatically. The app's plan picker reads from Stripe — not a hard-coded list.",
    highlights: [
      { icon: Tags, label: "Metadata-driven" },
      { icon: Repeat, label: "Auto-mirroring" },
      { icon: FileCheck2, label: "Validated on sync" },
    ],
    accent: "warning",
    icon: Tags,
  },
  {
    slug: "feature-flags",
    index: 12,
    group: "billing",
    eyebrow: "Toggles",
    title: "Feature Flags",
    headline: [
      "Ship anything.",
      "To anyone.",
      "On your schedule.",
    ],
    body:
      "Every distribution module ships behind a flag. Roll out per-tenant, A/B test the risky bits, kill switch the broken ones — all from one console.",
    highlights: [
      { icon: FlaskConical, label: "Per-tenant rollout" },
      { icon: GitBranch, label: "Kill switch" },
      { icon: Sparkles, label: "Module-registered" },
    ],
    accent: "info",
    icon: FlaskConical,
  },

  // ---------- Distribution ----------
  {
    slug: "customers",
    index: 13,
    group: "distribution",
    eyebrow: "CRM",
    title: "Customers",
    headline: [
      "Every account,",
      "every order,",
      "in one record.",
    ],
    body:
      "Customer cards roll up orders, invoices, payments, and aging. Pull one up and you know the whole story in five seconds.",
    highlights: [
      { icon: Users, label: "360° view" },
      { icon: LineChart, label: "Aging built-in" },
      { icon: FileText, label: "Doc history" },
    ],
    accent: "forest",
    icon: Users,
    liveDemoHref: "/reel/customer-bulk-import",
  },
  {
    slug: "suppliers",
    index: 14,
    group: "distribution",
    eyebrow: "Vendors",
    title: "Suppliers",
    headline: [
      "Your vendor book,",
      "bills attached,",
      "balances live.",
    ],
    body:
      "Track who you buy from, what they bill, and what you owe. Supplier pages tie bills, payments, and price history together.",
    highlights: [
      { icon: Truck, label: "Vendor master" },
      { icon: Receipt, label: "Linked bills" },
      { icon: LineChart, label: "Cost history" },
    ],
    accent: "forest",
    icon: Truck,
  },
  {
    slug: "products",
    index: 15,
    group: "distribution",
    eyebrow: "Catalog",
    title: "Products & Catalog",
    headline: [
      "A catalog that knows",
      "what you actually sell —",
      "units, packs, and all.",
    ],
    body:
      "Products carry their own units of measure, conversion factors, and categories. Add an alias and the AI importer learns it forever.",
    highlights: [
      { icon: Package, label: "UOM-aware" },
      { icon: Tags, label: "Categories" },
      { icon: Sparkles, label: "Alias learning" },
    ],
    accent: "forest",
    icon: Package,
  },
  {
    slug: "lots",
    index: 16,
    group: "distribution",
    eyebrow: "Traceability",
    title: "Lots",
    headline: [
      "Trace every lot.",
      "Every receipt.",
      "Every shipment.",
    ],
    body:
      "Lots track cost, expiry, and origin from the moment they're received until the last case ships. Audit trail comes free.",
    highlights: [
      { icon: ArchiveRestore, label: "Lot ledger" },
      { icon: Clock, label: "Expiry tracking" },
      { icon: FileCheck2, label: "Full audit trail" },
    ],
    accent: "forest",
    icon: ArchiveRestore,
  },
  {
    slug: "inventory",
    index: 17,
    group: "distribution",
    eyebrow: "Stock",
    title: "Inventory & FIFO Allocation",
    headline: [
      "FIFO inventory",
      "that adds up —",
      "to the case.",
    ],
    body:
      "Every receipt grows the lot. Every order draws it down, oldest-first. Reconciliation is a non-event.",
    highlights: [
      { icon: Boxes, label: "FIFO allocation" },
      { icon: LineChart, label: "Real-time stock" },
      { icon: ShieldCheck, label: "Reconciliation-safe" },
    ],
    accent: "success",
    icon: Boxes,
  },
  {
    slug: "price-chart",
    index: 18,
    group: "distribution",
    eyebrow: "Pricing",
    title: "Price Chart",
    headline: [
      "One price list.",
      "Everyone aligned.",
      "Customers included.",
    ],
    body:
      "Set tier prices once. Sales reps quote from the chart, customers see it in their portal, and history shows every change.",
    highlights: [
      { icon: Tags, label: "Tiered pricing" },
      { icon: Clock, label: "Versioned history" },
      { icon: Users, label: "Portal-visible" },
    ],
    accent: "forest",
    icon: Tags,
  },
  {
    slug: "sales-orders",
    index: 19,
    group: "distribution",
    eyebrow: "Orders",
    title: "Sales Orders",
    headline: [
      "Take the order.",
      "Pick the stock.",
      "Done.",
    ],
    body:
      "Build orders line-by-line, watch FIFO pull lots, lock in pricing, and hand off to fulfillment without a single spreadsheet.",
    highlights: [
      { icon: ShoppingCart, label: "FIFO-backed" },
      { icon: LineChart, label: "Live margin" },
      { icon: FileCheck2, label: "Pick lists" },
    ],
    accent: "forest",
    icon: ShoppingCart,
    liveDemoHref: "/reel/sales-order-fifo",
  },
  {
    slug: "sales-invoices",
    index: 20,
    group: "distribution",
    eyebrow: "Documents",
    title: "Sales Invoices & PDF",
    headline: [
      "Beautiful invoices.",
      "Generated in seconds.",
      "On your letterhead.",
    ],
    body:
      "Generate, preview, and send a polished PDF straight from the order. Branded, tenant-themed, and signed.",
    highlights: [
      { icon: FileText, label: "Branded PDF" },
      { icon: Mail, label: "Email from app" },
      { icon: FileCheck2, label: "Audit-ready" },
    ],
    accent: "success",
    icon: FileText,
  },
  {
    slug: "payments",
    index: 21,
    group: "distribution",
    eyebrow: "Receivables",
    title: "Payments",
    headline: [
      "Money in.",
      "Matched to invoices.",
      "Without the spreadsheet.",
    ],
    body:
      "Record payments against one or many invoices. Allocations are exact, aging clears in real time, and overpayments land on credit.",
    highlights: [
      { icon: Wallet, label: "Split allocation" },
      { icon: LineChart, label: "Aging live" },
      { icon: ShieldCheck, label: "Overpay credits" },
    ],
    accent: "success",
    icon: Wallet,
  },
  {
    slug: "supplier-invoices",
    index: 22,
    group: "distribution",
    eyebrow: "Payables",
    title: "Supplier Invoices",
    headline: [
      "Capture the bill.",
      "Receive the stock.",
      "Owe the right amount.",
    ],
    body:
      "Manual entry that doesn't feel manual. Inline lot creation, smart defaults, and one click to convert into a posted bill.",
    highlights: [
      { icon: Receipt, label: "Inline lot create" },
      { icon: Boxes, label: "Receives stock" },
      { icon: FileCheck2, label: "Posts to AP" },
    ],
    accent: "forest",
    icon: Receipt,
  },
  {
    slug: "ai-invoice-import",
    index: 23,
    group: "distribution",
    eyebrow: "AI assist",
    title: "Supplier Invoice AI Import",
    headline: [
      "Drop a PDF.",
      "We do the typing.",
      "Stock is current.",
    ],
    body:
      "Drag in a supplier invoice and Fluxora extracts every line, matches to your catalog, learns the aliases, and posts the bill.",
    highlights: [
      { icon: Sparkles, label: "AI extraction" },
      { icon: GitBranch, label: "Alias learning" },
      { icon: FileCheck2, label: "Auto-post" },
    ],
    accent: "info",
    icon: Sparkles,
    liveDemoHref: "/reel/invoice-import",
  },
  {
    slug: "plaid",
    index: 24,
    group: "distribution",
    eyebrow: "Banking",
    title: "Plaid Bank Linking & Sync",
    headline: [
      "Link the bank once.",
      "Transactions roll in.",
      "Forever.",
    ],
    body:
      "Hook up your bank via Plaid and Fluxora pulls transactions on a schedule. Match to invoices and bills as they come in.",
    highlights: [
      { icon: Landmark, label: "Plaid Link" },
      { icon: Repeat, label: "Daily sync" },
      { icon: Link2, label: "Auto-match" },
    ],
    accent: "info",
    icon: Landmark,
  },
  {
    slug: "expenses",
    index: 25,
    group: "distribution",
    eyebrow: "Spend",
    title: "Expenses",
    headline: [
      "Capture spend.",
      "Categorize it.",
      "Without the inbox dive.",
    ],
    body:
      "Drop a receipt, tag the category, attach to a vendor. Expenses roll into the P&L the same day.",
    highlights: [
      { icon: Wallet, label: "Receipt capture" },
      { icon: Tags, label: "Auto-categorize" },
      { icon: LineChart, label: "Hits the P&L" },
    ],
    accent: "forest",
    icon: Wallet,
  },

  // ---------- Ops ----------
  {
    slug: "dashboard",
    index: 26,
    group: "ops",
    eyebrow: "Overview",
    title: "Dashboard (KPIs)",
    headline: [
      "Today, at a glance.",
      "Yesterday, in context.",
      "Trends, in your face.",
    ],
    body:
      "Revenue, margin, aging, inventory turns — the numbers you check every morning, in one place, refreshed on load.",
    highlights: [
      { icon: BarChart3, label: "Live KPIs" },
      { icon: LineChart, label: "Trend charts" },
      { icon: Activity, label: "Refreshed on load" },
    ],
    accent: "info",
    icon: LayoutDashboard,
  },
  {
    slug: "support",
    index: 27,
    group: "ops",
    eyebrow: "Help",
    title: "Support Tickets",
    headline: [
      "Get help.",
      "Give help.",
      "All inside the app.",
    ],
    body:
      "Tenants open tickets, the platform team triages them, the SLA clock starts ticking — no separate help-desk to swivel-chair to.",
    highlights: [
      { icon: LifeBuoy, label: "In-app tickets" },
      { icon: Timer, label: "SLA tracking" },
      { icon: Workflow, label: "Triage queue" },
    ],
    accent: "info",
    icon: LifeBuoy,
  },
  {
    slug: "platform-admin",
    index: 28,
    group: "ops",
    eyebrow: "Internal",
    title: "Platform Admin",
    headline: [
      "Every tenant.",
      "Every plan.",
      "One console.",
    ],
    body:
      "The admin host — admin.fluxora.app — is the cockpit. Find a tenant, switch a flag, pause a sub, read a log.",
    highlights: [
      { icon: Crown, label: "Tenant directory" },
      { icon: ShieldCheck, label: "Reserved host" },
      { icon: Workflow, label: "Audit-logged" },
    ],
    accent: "forest",
    icon: Crown,
  },
  {
    slug: "workspace-branding",
    index: 29,
    group: "ops",
    eyebrow: "Brand",
    title: "Workspace Settings & Branding",
    headline: [
      "Your logo.",
      "Your colors.",
      "Top of every PDF.",
    ],
    body:
      "Drop a logo, pick a palette, set your default ledger preferences. The whole workspace and every doc takes the brand.",
    highlights: [
      { icon: PaintBucket, label: "Logo & palette" },
      { icon: FileText, label: "PDF letterhead" },
      { icon: Workflow, label: "Per-tenant" },
    ],
    accent: "forest",
    icon: PaintBucket,
  },
  {
    slug: "file-uploads",
    index: 30,
    group: "ops",
    eyebrow: "Storage",
    title: "File Uploads (Cloudflare R2)",
    headline: [
      "Drop a file.",
      "It lands in R2.",
      "Signed-URL'd back in.",
    ],
    body:
      "Receipts, invoices, branding, attachments — anything you upload goes to R2 with tenant-scoped keys and short-lived signed URLs.",
    highlights: [
      { icon: UploadCloud, label: "Cloudflare R2" },
      { icon: ShieldCheck, label: "Tenant-scoped" },
      { icon: Timer, label: "Short-lived URLs" },
    ],
    accent: "info",
    icon: UploadCloud,
  },
  {
    slug: "cron-jobs",
    index: 31,
    group: "ops",
    eyebrow: "Automation",
    title: "Cron Jobs",
    headline: [
      "What runs",
      "while you sleep.",
      "And what to do when it breaks.",
    ],
    body:
      "Plaid sync, catalog mirror, aging snapshot, billing rollups — each on a schedule, each with retries, each visible in the admin log.",
    highlights: [
      { icon: Clock, label: "Scheduled tasks" },
      { icon: Repeat, label: "Retry-safe" },
      { icon: Activity, label: "Logged & alerted" },
    ],
    accent: "info",
    icon: Clock,
  },
  {
    slug: "observability",
    index: 32,
    group: "ops",
    eyebrow: "Signals",
    title: "Observability",
    headline: [
      "If it breaks,",
      "we know.",
      "Often before you do.",
    ],
    body:
      "Sentry for errors, PostHog for behavior, Better Stack for uptime, Upstash for rate-limits, audit logs for the trail.",
    highlights: [
      { icon: AlertCircle, label: "Sentry" },
      { icon: BarChart3, label: "PostHog" },
      { icon: Activity, label: "Uptime & audit" },
    ],
    accent: "warning",
    icon: AlertCircle,
  },
  {
    slug: "changelog",
    index: 33,
    group: "ops",
    eyebrow: "Built in public",
    title: "Changelog",
    headline: [
      "Every release.",
      "Every fix.",
      "Out in the open.",
    ],
    body:
      "Ship notes from the team, pinned at /changelog. What we shipped, what we fixed, what's next.",
    highlights: [
      { icon: Newspaper, label: "In-app page" },
      { icon: GitBranch, label: "Per-release" },
      { icon: Sparkles, label: "Tenant-visible" },
    ],
    accent: "success",
    icon: Newspaper,
  },
];

export function getFeatureBySlug(slug: string): Feature | undefined {
  return FEATURES.find((feature) => feature.slug === slug);
}

export function getFeaturesByGroup(): Record<FeatureGroup, Feature[]> {
  const grouped: Record<FeatureGroup, Feature[]> = {
    auth: [],
    tenancy: [],
    billing: [],
    distribution: [],
    ops: [],
  };
  for (const feature of FEATURES) {
    grouped[feature.group].push(feature);
  }
  return grouped;
}
