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

type ResetPasswordProps = {
  name?: string | null;
  url: string;
};

export function ResetPasswordEmail({ name, url }: ResetPasswordProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Fluxora password</Preview>
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
            Reset your password
          </Heading>

          <Text style={{ fontSize: "14px", color: "#334155" }}>
            {name ? `Hi ${name},` : "Hi,"}
          </Text>

          <Text style={{ fontSize: "14px", color: "#334155" }}>
            We received a request to reset your password.
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
              Reset password
            </Button>
          </Section>

          <Text style={{ fontSize: "12px", color: "#64748b" }}>
            If you did not request this, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
