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

type VerifyEmailProps = {
  name?: string | null;
  url: string;
};

export function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email</Preview>
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
            Verify your email
          </Heading>

          <Text style={{ fontSize: "14px", color: "#334155" }}>
            {name ? `Hi ${name},` : "Hi,"}
          </Text>

          <Text style={{ fontSize: "14px", color: "#334155" }}>
            Please confirm your email address to finish setting up your account.
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
              Verify email
            </Button>
          </Section>

          <Text style={{ fontSize: "12px", color: "#64748b" }}>
            If you did not create this account, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
