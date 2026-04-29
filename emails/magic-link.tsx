import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type MagicLinkEmailProps = {
  name?: string | null;
  url: string;
};

export function MagicLinkEmail({ name, url }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your sign-in link</Preview>
      <Body
        style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            margin: "40px auto",
            padding: "32px",
            borderRadius: "12px",
            maxWidth: "560px",
            border: "1px solid #e2e8f0",
          }}
        >
          <Heading style={{ fontSize: "24px", marginBottom: "16px" }}>
            Sign in to Acme Distribution
          </Heading>

          <Text style={{ fontSize: "14px", color: "#334155" }}>
            {name ? `Hi ${name},` : "Hi,"}
          </Text>

          <Text style={{ fontSize: "14px", color: "#334155" }}>
            Click the button below to sign in. This link expires soon and can be
            used securely once.
          </Text>

          <Section style={{ margin: "24px 0" }}>
            <Button
              href={url}
              style={{
                backgroundColor: "#1d4ed8",
                color: "#ffffff",
                padding: "12px 18px",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "600",
              }}
            >
              Continue to sign in
            </Button>
          </Section>

          <Text style={{ fontSize: "12px", color: "#64748b" }}>
            If you didn&apos;t request this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
