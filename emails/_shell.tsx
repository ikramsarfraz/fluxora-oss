import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/**
 * Shared chrome for every system email: cream page canvas, Fluxora
 * brand-mark masthead, warm-white card, and a one-line legal footer.
 * Anything content-specific lives inside `children`.
 *
 * Why the inline styles: Gmail / Outlook strip class names and most CSS
 * variables. The Fluxora design tokens are inlined as literal hex here
 * so the rendered email stays on-brand across every client.
 */

export const tokens = {
  page: "#F5EFE0",
  surface: "#EDE5D2",
  card: "#FBF7EC",
  cardWarm: "#FDF9F0",
  border: "#DDD3B8",
  borderSoft: "#E5DCC4",
  divider: "#F0EBDC",
  forest: "#1F3A2E",
  forestMid: "#2D5040",
  forestTint: "#DCE5DD",
  gold: "#C9A961",
  goldDeep: "#8B7332",
  ink: "#1A1A14",
  inkWarm: "#3A3528",
  subtle: "#6B6451",
  muted: "#A89F86",
  successFg: "#4A6B2F",
  warningFg: "#6B4A0E",
} as const;

const FONT_STACK =
  '"Archivo", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const MONO_STACK =
  '"Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace';

export function EmailShell({
  preview,
  eyebrow,
  children,
}: {
  preview: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Archivo"
          fallbackFontFamily={["Helvetica", "Arial"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/archivo/v19/k3kQo8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTNDNZ9xdp.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Archivo"
          fallbackFontFamily={["Helvetica", "Arial"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/archivo/v19/k3kQo8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTNDNZ-RZp.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: tokens.page,
          color: tokens.ink,
          fontFamily: FONT_STACK,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "0 auto",
            padding: "40px 24px 32px",
          }}
        >
          {/* Masthead */}
          <Section style={{ marginBottom: 20 }}>
            <BrandLockup />
          </Section>

          {/* Card */}
          <Section
            style={{
              backgroundColor: tokens.card,
              border: `1px solid ${tokens.borderSoft}`,
              borderRadius: 12,
              padding: "32px 32px 28px",
              boxShadow:
                "0 1px 2px rgba(26,26,20,0.05), 0 8px 24px rgba(26,26,20,0.06)",
            }}
          >
            {eyebrow ? (
              <Text
                style={{
                  margin: 0,
                  marginBottom: 10,
                  fontFamily: FONT_STACK,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: tokens.subtle,
                }}
              >
                {eyebrow}
              </Text>
            ) : null}
            {children}
          </Section>

          {/* Footer */}
          <Section
            style={{
              paddingTop: 20,
              textAlign: "center" as const,
            }}
          >
            <Text
              style={{
                margin: 0,
                marginBottom: 4,
                fontFamily: MONO_STACK,
                fontSize: 11,
                letterSpacing: "0.04em",
                color: tokens.muted,
              }}
            >
              Fluxora · multi-tenant ops for distribution
            </Text>
            <Text
              style={{
                margin: 0,
                fontFamily: FONT_STACK,
                fontSize: 12,
                color: tokens.subtle,
              }}
            >
              <Link
                href="https://fluxora.app/privacy"
                style={{ color: tokens.subtle, textDecoration: "none" }}
              >
                Privacy
              </Link>
              {"  ·  "}
              <Link
                href="https://fluxora.app/terms"
                style={{ color: tokens.subtle, textDecoration: "none" }}
              >
                Terms
              </Link>
              {"  ·  "}
              <Link
                href="https://fluxora.app/"
                style={{ color: tokens.subtle, textDecoration: "none" }}
              >
                fluxora.app
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/**
 * Inline "F" mark + Fluxora wordmark. The gold underlines under the
 * mark and the first three letters of the wordmark are absolutely-
 * positioned <span> elements — Gmail and Outlook 2019+ render them.
 * Very old clients fall back to the F glyph alone, which still reads
 * as a brand mark.
 */
function BrandLockup() {
  return (
    <table
      role="presentation"
      cellSpacing={0}
      cellPadding={0}
      border={0}
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        <tr>
          <td style={{ verticalAlign: "middle", paddingRight: 9 }}>
            <span
              style={{
                display: "inline-block",
                width: 28,
                height: 28,
                borderRadius: 6,
                backgroundColor: tokens.forest,
                color: tokens.cardWarm,
                fontFamily: FONT_STACK,
                fontWeight: 600,
                fontSize: 15,
                lineHeight: "28px",
                textAlign: "center" as const,
                position: "relative" as const,
              }}
            >
              F
              <span
                style={{
                  position: "absolute" as const,
                  left: 7,
                  right: 7,
                  bottom: 5,
                  height: 1.5,
                  backgroundColor: tokens.gold,
                  lineHeight: "1.5px",
                  fontSize: 0,
                }}
              >
                &nbsp;
              </span>
            </span>
          </td>
          <td style={{ verticalAlign: "middle" }}>
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 19,
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: tokens.ink,
                position: "relative" as const,
              }}
            >
              Fluxora
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ── Reusable email primitives ───────────────────────────────────────── */

/** Forest pill button. */
export function PrimaryButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <table
      role="presentation"
      cellSpacing={0}
      cellPadding={0}
      border={0}
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: tokens.forest,
              borderRadius: 6,
              padding: "12px 22px",
            }}
          >
            <Link
              href={href}
              style={{
                display: "inline-block",
                color: tokens.cardWarm,
                fontFamily: FONT_STACK,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                lineHeight: 1,
              }}
            >
              {label}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Display heading inside the card. */
export function Display({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: 0,
        marginBottom: 10,
        fontFamily: FONT_STACK,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "-0.03em",
        lineHeight: 1.15,
        color: tokens.ink,
      }}
    >
      {children}
    </Text>
  );
}

/** Body paragraph. */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: 0,
        marginBottom: 14,
        fontFamily: FONT_STACK,
        fontSize: 15,
        lineHeight: 1.55,
        color: tokens.inkWarm,
      }}
    >
      {children}
    </Text>
  );
}

export function Helper({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: 0,
        marginTop: 18,
        fontFamily: FONT_STACK,
        fontSize: 12.5,
        lineHeight: 1.5,
        color: tokens.subtle,
      }}
    >
      {children}
    </Text>
  );
}

/** Fallback raw URL displayed below the button. */
export function FallbackUrl({ url }: { url: string }) {
  return (
    <Text
      style={{
        margin: 0,
        marginTop: 14,
        fontFamily: MONO_STACK,
        fontSize: 12,
        lineHeight: 1.5,
        color: tokens.subtle,
        wordBreak: "break-all" as const,
      }}
    >
      Or paste this link into your browser:{" "}
      <Link href={url} style={{ color: tokens.forest, textDecoration: "none" }}>
        {url}
      </Link>
    </Text>
  );
}

/** Definition-list row — left label (mono small caps), right value. */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <table
      role="presentation"
      cellSpacing={0}
      cellPadding={0}
      border={0}
      width="100%"
      style={{ borderCollapse: "collapse", marginTop: 8 }}
    >
      <tbody>
        <tr>
          <td
            style={{
              width: 120,
              paddingRight: 12,
              fontFamily: MONO_STACK,
              fontSize: 10.5,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: tokens.subtle,
              verticalAlign: "top" as const,
            }}
          >
            {label}
          </td>
          <td
            style={{
              fontFamily: FONT_STACK,
              fontSize: 13,
              color: tokens.ink,
              verticalAlign: "top" as const,
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Forest-tinted note callout at the bottom of an email body. */
export function NoteCallout({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        marginTop: 22,
        padding: "12px 14px",
        backgroundColor: tokens.forestTint,
        border: `1px solid #B8CDBE`,
        borderRadius: 6,
      }}
    >
      <Text
        style={{
          margin: 0,
          fontFamily: FONT_STACK,
          fontSize: 12.5,
          lineHeight: 1.5,
          color: tokens.forest,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

export { FONT_STACK, MONO_STACK };
