import type { Metadata } from "next";

import { LegalDocShell } from "@/components/legal/legal-doc-shell";

export const metadata: Metadata = {
  title: "Privacy Policy · Fluxora",
  description:
    "How Fluxora collects, uses, and protects personal and tenant data for our ERP platform.",
};

const LAST_UPDATED = "April 25, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocShell
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      toc={[
        { id: "overview", label: "Overview" },
        { id: "collect", label: "Data we collect" },
        { id: "use", label: "How we use data" },
        { id: "sharing", label: "Sharing and subprocessors" },
        { id: "retention", label: "Retention" },
        { id: "security", label: "Security" },
        { id: "rights", label: "Your choices and rights" },
        { id: "international", label: "International transfers" },
        { id: "children", label: "Children" },
        { id: "changes", label: "Changes to this policy" },
        { id: "contact", label: "Contact us" },
      ]}
    >
      <section id="overview">
        <h2>Overview</h2>
        <p>
          Fluxora (&quot;we,&quot; &quot;us,&quot;) provides a hosted, multi-tenant enterprise resource
          planning (&quot;ERP&quot;) platform for distributors and businesses. This Privacy Policy
          describes how we collect, use, disclose, and protect information when you use our websites,
          applications, APIs, authentication flows (including email magic links and optional Google
          sign-in), billing (via Stripe), and support tools.
        </p>
        <p>
          Fluxora operates as a <strong>data processor</strong> for much of your business content
          (for example orders and customer records uploaded by your organization), depending on how
          you configure integrations. Where we determine purposes and means—for example billing and
          product analytics—we act as a <strong>controller</strong> as described below.
        </p>
      </section>

      <section id="collect">
        <h2>Data we collect</h2>
        <ul>
          <li>
            <strong>Account and authentication information.</strong> When you register or sign in,
            we collect identifiers such as your email address, name (first and/or last), optional
            profile image metadata from federated login, and identifiers associated with sessions and
            security events.
          </li>
          <li>
            <strong>Tenant (workspace) content.</strong> You and authorized users submit data tied to a
            workspace, such as organization details, contacts, customer records, products, inventory,
            suppliers, pricing, quotes, orders, invoices, shipments, payments, attachments, audit
            events, collaboration features, internal notes where offered, support tickets including
            message content you provide, and other operational ERP data (&quot;<strong>Tenant
            Data</strong>&quot;).
          </li>
          <li>
            <strong>Usage, diagnostic, and log data.</strong> We automatically collect technical data
            when you interact with our service, including timestamps, approximate location derived
            from IP when needed for fraud prevention or security, HTTP requests, referrer, device type,
            browser, app version identifiers, structured error telemetry, latency metrics where
            applicable, authentication events (sign-in successes and failures at a high level), and
            similar operational logs maintained to keep the platform reliable and secure.
          </li>
          <li>
            <strong>Billing data.</strong> When you subscribe to paid offerings, Stripe (or successor
            payment processor) collects and processes billing details such as billing contact email,
            plan selection, invoicing identifiers, subscription status updates, partial card metadata
            (for example brand and expiry as processed by Stripe), payment success or failure statuses,
            and tax-related identifiers you provide checkout-side. We retain references and history
            needed to reconcile access to your billing account.
          </li>
          <li>
            <strong>Communications.</strong> If you correspond with sales or contact support via
            email forms or in-product tickets, we process the contents of messages and identifiers
            you include.
          </li>
        </ul>
      </section>

      <section id="use">
        <h2>How we use data</h2>
        <ul>
          <li>
            <strong>Provide and operate the service.</strong> For example provisioning tenants,
            authenticating sessions, syncing data your users enter, powering search and reporting where
            available, enforcing role-based permissions, invoicing entitlement, running background jobs,
            integrations (when enabled), exporting data at your direction where supported, backups,
            and maintaining availability.
          </li>
          <li>
            <strong>Improve reliability and product direction.</strong> We may use aggregated,
            de-identified, or summarized usage patterns—for example funnel completion rates—to
            understand feature adoption without needing to disclose customer-specific transaction
            narratives.
          </li>
          <li>
            <strong>Billing and account administration.</strong> Managing subscriptions through Stripe,
            sending transactional notices about invoicing failures, seat changes subject to configuration,
            reminders about trial status, receipts when applicable, responding to lawful account-holder
            requests, enforcing policies, enforcing anti-abuse safeguards, enforcing fair use safeguards.
          </li>
          <li>
            <strong>Communications relevant to security and lawful operations.</strong> Administrative
            messages about outages, breaches when required under law, substantive changes that affect
            your rights, confirmations of opt-out requests processed.
          </li>
          <li>
            <strong>Legal compliance.</strong> When required—to honor subpoenas, enforce our agreements,
            protect Fluxora&#39;s legitimate interests subject to overriding law, cooperate with lawful
            requests narrowly tailored.
          </li>
        </ul>
      </section>

      <section id="sharing">
        <h2>Sharing and subprocessors</h2>
        <p>
          We do not <strong>sell personal information</strong> and we do not share Tenant Data for
          third-party marketing lists. Sharing is limited:
        </p>
        <ul>
          <li>
            <strong>Stripe:</strong> we route payments through Stripe for subscription checkout,
            invoicing integrations (where activated), webhook-driven subscription state reconciliation,
            dunning retries where Stripe supports them depending on gateway configuration configured by
            you/the cardholder appropriately.
          </li>
          <li>
            <strong>Email delivery:</strong> we send transactional and product email (including magic-link
            authentication invitations, subscription lifecycle notices, onboarding guidance, invitations
            to join organizations, alerts about security-critical events involving your credential)
            via an email sending provider compatible with transactional delivery such as{' '}
            <strong>Resend</strong> or an equivalent transactional ESP we operate under materially
            similar privacy commitments.
          </li>
          <li>
            <strong>Hosting and observability vendors:</strong> our cloud infrastructure vendors (for
            example managed PostgreSQL, object storage, secret management where applicable),
            optionally application performance monitoring tooling, CDN or edge providers, log retention,
            intrusion detection—notwithstanding we aim to segregate tenancy logically.
          </li>
          <li>
            <strong>Integrated providers you authorize:</strong> when you deliberately connect OAuth
            providers beyond Google SSO or enable integrations, those providers&#39; terms govern their
            processing of redirected tokens or API calls we forward per your administrators&#39;
            selections.
          </li>
          <li>
            <strong>Authorities when required;</strong>
            mergers or acquisitions subject to safeguards.
          </li>
          <li>
            <strong>Vendors assisting support:</strong> if we allow some support communications to route
            through ticketers (for example ticketing SaaS)—only minimally necessary excerpts.
          </li>
          <li>
            <strong>Anonymized or aggregated benchmarking material</strong> if we publish industry
            metrics—we will not knowingly include Customer Confidential Information that could identify
            a specific customer without contractual permission unless already public factual matter.
          </li>
        </ul>
      </section>

      <section id="retention">
        <h2>Retention</h2>
        <p>
          We retain Tenant Data according to administrators&#39; instructions where technically
          feasible—for example honoring deletion workflows on objects if supported—or until you delete an
          account or disconnect a tenant when permissible. Operational logs retention windows vary based
          on security needs (typically between days and twelve months rolling). Billing records retained
          for as long as needed to meet tax, accounting, and audit obligations. Support tickets may be
          archived for follow-up quality for a bounded period then purged or anonymized.
        </p>
        <p>
          When you delete an account, we may retain minimal records to prevent re-registration abuse,
          prove compliance, or resolve disputes for a limited period consistent with law.
        </p>
      </section>

      <section id="security">
        <h2>Security</h2>
        <p>
          We implement administrative, technical, and organizational measures designed to protect
          against unauthorized access, alteration, disclosure, or destruction appropriate to the risk of
          the processing—TLS in transit for web traffic, least-privilege access for employees, secrets
          rotation, encryption at rest for certain provider-managed stores as applicable, tenant-scoped
          database row controls in application logic, monitoring and alerting, vulnerability response
          processes. No online service is perfectly secure; you should keep credentials secret, enable
          multi-factor authentication when we offer it, and promptly notify us of suspected compromise.
        </p>
      </section>

      <section id="rights">
        <h2>Your choices and rights</h2>
        <p>
          Depending on where you live, privacy laws may grant rights such as access, correction,
          deletion, portability, objection to certain processing, restriction, or withdrawal of
          consent for non-essential cookies or marketing (we send very little marketing by default for
          B2B ERP). To exercise rights, email us (see Contact). We will verify requests consistent with
          law and may need your workspace owner to coordinate for Tenant Data we process as a
          processor.
        </p>
        <p>
          You may opt out of non-essential communications (we limit promotional email for B2B contexts);
          we will always send essential transactional or security notifications required to operate your
          account.
        </p>
      </section>

      <section id="international">
        <h2>International transfers</h2>
        <p>
          If you access Fluxora from outside the geography where servers primarily reside (for example US
          regions hosted by Neon or similar Postgres providers depending on deployment), transfers may
          occur under appropriate safeguards described in DPAs as applicable once executed for enterprise
          customers.
        </p>
      </section>

      <section id="children">
        <h2>Children</h2>
        <p>
          Fluxora is a B2B product not directed to minors under sixteen; we do not knowingly collect data
          from children. Contact us if you believe a minor submitted data so we may delete promptly.
        </p>
      </section>

      <section id="changes">
        <h2>Changes to this policy</h2>
        <p>
          We may update this Privacy Policy periodically. Material changes will be signaled through our
          product interface, banner, changelog, or email to account owners when appropriate. Continuing
          to use Fluxora thereafter constitutes acknowledgement of meaningful updates absent mandatory
          opt-in regimes requiring separate consent—which we honor when mandated.
        </p>
      </section>

      <section id="contact">
        <h2>Contact us</h2>
        <p>
          Questions or requests about privacy:&nbsp;
          <a href="mailto:support@yourdomain.com" className="font-medium text-primary underline">
            support@yourdomain.com
          </a>
        </p>
      </section>
    </LegalDocShell>
  );
}
