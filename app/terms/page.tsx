import type { Metadata } from "next";

import { LegalDocShell } from "@/components/legal/legal-doc-shell";
import { publicSupportEmail } from "@/lib/public-contact";

export const metadata: Metadata = {
  title: "Terms of Service · Fluxora",
  description:
    "Terms governing use of the Fluxora multi-tenant ERP SaaS platform, billing, and acceptable use.",
};

const LAST_UPDATED = "April 25, 2026";
const VERSION = "2026.04";

const TOC = [
  { id: "agreement", label: "Agreement to these terms" },
  { id: "service", label: "Description of the service" },
  { id: "accounts", label: "Accounts and access" },
  { id: "acceptable", label: "Acceptable use" },
  { id: "data", label: "Customer data and privacy" },
  { id: "billing", label: "Fees, billing, and taxes" },
  { id: "stripe", label: "Payments via Stripe" },
  { id: "termination", label: "Suspension and termination" },
  { id: "disclaimer", label: "Disclaimer of warranties" },
  { id: "liability", label: "Limitation of liability" },
  { id: "general", label: "General provisions" },
  { id: "contact", label: "Contact" },
];

export default function TermsOfServicePage() {
  return (
    <LegalDocShell
      title="Terms of Service"
      eyebrowSuffix="Folio 02 of 03"
      lede="The contract between your workspace and Fluxora. What we build, what you owe, what each of us is responsible for when the warehouse opens on Tuesday morning."
      lastUpdated={LAST_UPDATED}
      version={VERSION}
      readingTime="~9 min"
      revisionsHref="/changelog"
      activeLegalHref="/terms"
      docFootLabel={`End of document · § ${TOC.length} of ${TOC.length}`}
      docFootLinks={[
        { label: "Privacy Policy →", href: "/privacy" },
        { label: "Changelog →", href: "/changelog" },
      ]}
      toc={TOC}
    >
      <section id="agreement">
        <h2>Agreement to these terms</h2>
        <p>
          These Terms of Service (&ldquo;<strong>Terms</strong>&rdquo;) govern access to or use of
          Fluxora&rsquo;s cloud ERP software including web applications, APIs, ancillary documentation,
          trial experiences, and onboarding flows — subject to supplementary order forms referencing
          these Terms (collectively the &ldquo;<strong>Services</strong>&rdquo;) — provided by Fluxora
          (&ldquo;<strong>Fluxora</strong>,&rdquo; &ldquo;<strong>we</strong>,&rdquo; &ldquo;<strong>us</strong>&rdquo;) and you,
          either individually or on behalf of an entity you represent (&ldquo;<strong>Customer</strong>,&rdquo;
          &ldquo;<strong>you</strong>&rdquo;).
        </p>
        <p>
          By registering a workspace, inviting users, or otherwise accessing the Services after being
          presented reasonable notice of these Terms, you agree to these Terms plus any supplementary
          written agreement referencing them.
        </p>
      </section>

      <section id="service">
        <h2>Description of the service</h2>
        <p>
          Fluxora is a{" "}
          <strong>
            hosted, multi-tenant business software suite for distributors and similar enterprises
          </strong>
          , encompassing modules commonly including — but not strictly limited to — customer
          relationship data, quotations and sales orders where enabled, invoicing, inventory valuation
          snapshots, purchasing, supplier invoicing, lot traceability when configured, reporting views,
          user administration, internal support ticketing to our team, usage analytics for reliability,
          and subscription management via Stripe.
        </p>
        <p>
          Features vary by plan; we may add, modify, or retire non-material features with reasonable
          advance notice when practical. The Services are provided <strong>online only</strong> except
          where we explicitly deliver downloadable artifacts (for example certain PDF exports generated
          at request) — no implied promise of offline perpetual copies of full datasets beyond export
          tools we supply.
        </p>
      </section>

      <section id="accounts">
        <h2>Accounts and access</h2>
        <p>
          You must provide accurate registration information including a valid organizational email
          unless we authorize consumer domains for testing tenants. Administrators control invitations
          to other end users authorized to manipulate Tenant Data.
        </p>
        <p>
          You are responsible for maintaining password and device security and promptly revoking
          departing personnel from your workspace credentials. Authentication may include email magic
          links and optionally Google SSO; phishing resistance is shared. We may suspend accounts
          exhibiting abuse or compromise pending verification.
        </p>
      </section>

      <section id="acceptable">
        <h2>Acceptable use</h2>
        <p>You must not, and must not permit users to:</p>
        <ul>
          <li>
            Violate applicable export control, sanctions, anti-bribery, data protection, or sectoral
            regulations.
          </li>
          <li>
            Upload malware, attempt unauthorized access to other tenants, probe or stress-test our
            infrastructure without prior written permission, or interfere with service integrity.
          </li>
          <li>
            Store or process highly regulated categories (for example full payment card numbers outside
            Stripe Elements patterns we document, certain health records where we have not signed a
            BAA, governmental classified material) without pre-approved configuration.
          </li>
          <li>
            Use the Services to build a directly competitive multi-tenant ERP clone by systematic
            scraping or bulk automated extraction for training external models without separate written
            consent (ordinary API usage for your business operations is fine).
          </li>
          <li>
            Harass support staff or misrepresent impersonation affiliation with Fluxora externally.
          </li>
        </ul>
        <p>
          We reserve the ability to throttle or temporarily suspend offending workloads or workspaces
          consistent with escalating abuse signals.
        </p>
      </section>

      <section id="data">
        <h2>Customer data and privacy</h2>
        <p>
          As between Fluxora and Customer,{" "}
          <strong>Tenant Data that your users upload remains owned by you</strong> (subject to
          third-party rights). You grant Fluxora a limited license to host, process (including
          decrypting backups for restore), replicate for durability, anonymize aggregates, and derive
          statistics not identifying you in final published form — all solely to operate, secure,
          defend, comply, analyze reliability, invoice, integrate per your admins&rsquo; settings,
          fulfill professional services if separately ordered, and improve non-identifiable
          benchmarking.
        </p>
        <div className="callout">
          <div className="ic">→</div>
          <p className="b">
            Your privacy specifics sit primarily in our separate{" "}
            <a href="/privacy">
              <strong>Privacy Policy</strong>
            </a>
            , incorporated here by reference.
          </p>
        </div>
      </section>

      <section id="billing">
        <h2>Fees, billing, taxes, and refunds</h2>
        <p>
          Paid plans recur at the cadence advertised at checkout (&ldquo;<strong>Subscription</strong>
          &rdquo;). Unless negotiated otherwise in an order form referencing these Terms explicitly,{" "}
          <strong>
            fees are non-cancellable commitments for each prepaid term upon charge authorization
          </strong>
          . We <strong>do not refund fees</strong> except where required by law or where we explicitly
          communicated a money-back eligibility window contemporaneous with signup.
        </p>
        <p>
          Trials or promotional credits expire automatically when communicated; unused credits do not
          roll automatically unless expressly stated during the promotion banner. You authorize us and
          our payment processor to charge your chosen payment method for applicable taxes, usage
          overages if metered features exist, plan upgrades you initiate, and any chargebacks we
          successfully defend if we elect to pass through processing costs subject to reasonable
          notice.
        </p>
      </section>

      <section id="stripe">
        <h2>Payments via Stripe</h2>
        <p>
          Subscription checkout and card handling run through <strong>Stripe</strong> (or successor
          processor we notify). Stripe&rsquo;s services are subject to the{" "}
          <a
            href="https://stripe.com/legal/ssa"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe Services Agreement
          </a>{" "}
          between you and Stripe as applicable.
        </p>
        <p>
          We only receive limited metadata required to unlock your workspace entitlements; we do not
          store full primary account numbers on Fluxora application servers outside tokenization
          patterns Stripe documents.
        </p>
      </section>

      <section id="termination">
        <h2>Suspension and termination</h2>
        <p>
          You may stop using the Services anytime; cancel recurring billing through the billing portal
          where available (otherwise contact support). We may suspend or terminate access for material
          breach uncured after reasonable notice when safe to provide, non-payment after grace windows,
          legal compulsion, or prolonged serious security risk.
        </p>
        <p>
          Certain provisions — fees owed, liability limits, dispute resolution, governing law — survive
          termination. After termination, we may delete Tenant Data per our retention schedule unless
          separate backup copies are contractually required and executed in an enterprise addendum.
        </p>
      </section>

      <section id="disclaimer">
        <h2>Disclaimer of warranties</h2>
        <div className="legalese">
          <p>
            Except where prohibited by law, the Services are provided &ldquo;as is&rdquo; and
            &ldquo;as available&rdquo; without warranties of any kind whether express, implied, or
            statutory, including merchantability, fitness for a particular purpose, title, or
            non-infringement.
          </p>
          <p>
            We do not warrant uninterrupted or error-free operation; you acknowledge cloud availability
            depends on factors outside our reasonable control including internet outages or upstream
            provider incidents.
          </p>
        </div>
      </section>

      <section id="liability">
        <h2>Limitation of liability</h2>
        <div className="legalese">
          <p>
            To the maximum extent permitted by applicable law, neither Fluxora nor its suppliers will
            be liable for any indirect, incidental, special, consequential, exemplary, or punitive
            damages, or any loss of profits, revenue, goodwill, data (except where mandatory data
            protection law requires otherwise), or business interruption, even if advised of the
            possibility.
          </p>
          <p>
            Our aggregate liability arising out of or related to the Services in any twelve-month
            period is limited to the greater of (a) the amounts you paid us for the Services during
            that period or (b) one hundred US dollars (US $100) if you used only free tier offerings —
            unless a separately signed order form states a different liability cap.
          </p>
        </div>
        <p>
          Some jurisdictions restrict limitations; in those cases our liability is limited to the
          fullest extent still lawful.
        </p>
      </section>

      <section id="general">
        <h2>General provisions</h2>
        <p>
          <strong>Governing law and venue.</strong> These Terms are governed by the laws of{" "}
          <strong>[Your jurisdiction], United States</strong>, excluding conflict-of-law rules that
          would send disputes elsewhere. Subject to applicable arbitration or small-claims carve-outs
          you and we may agree in a future enterprise addendum, exclusive jurisdiction and venue for
          disputes will be courts located in that jurisdiction unless mandatory consumer protections
          require otherwise.
        </p>
        <p>
          <strong>Assignment.</strong> You may not assign these Terms without our prior written
          consent except to an affiliate or successor in a merger involving your business; we may
          assign to an affiliate or acquirer with notice.
        </p>
        <p>
          <strong>Entire agreement; order of precedence.</strong> These Terms plus the Privacy Policy
          and any executed order form constitute the entire agreement on its subject matter;
          conflicting terms in a purchase order not signed by Fluxora do not apply.
        </p>
        <p>
          <strong>Changes.</strong> We may modify these Terms by posting an updated version and
          updating the &ldquo;last updated&rdquo; date; material adverse changes to fee structures or
          liability reductions will be highlighted or emailed when practicable. Continued use after the
          effective date constitutes acceptance except where local law requires explicit consent.
        </p>
      </section>

      <section id="contact">
        <h2>Contact</h2>
        <p>Legal notices and contractual questions:</p>
        <div className="callout">
          <div className="ic">@</div>
          <p className="b">
            <a href={`mailto:${publicSupportEmail}`}>
              <strong>{publicSupportEmail}</strong>
            </a>
          </p>
        </div>
      </section>
    </LegalDocShell>
  );
}
