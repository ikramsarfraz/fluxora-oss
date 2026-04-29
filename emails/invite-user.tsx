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

type InviteUserEmailProps = {
  fullName: string;
  inviteUrl: string;
};

export function InviteUserEmail({ fullName, inviteUrl }: InviteUserEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`You're invited to Fluxora`}</Preview>
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
            {`You're invited to Fluxora`}
          </Heading>
          <Text style={{ fontSize: "14px", color: "#334155" }}>
            Hi {fullName},
          </Text>
          <Text style={{ fontSize: "14px", color: "#334155" }}>
            Use the link below to accept your invitation and finish joining this
            workspace in Fluxora.
          </Text>
          <Section style={{ margin: "24px 0" }}>
            <Button href={inviteUrl}>Accept invitation</Button>
          </Section>
          <Text style={{ fontSize: "12px", color: "#64748b" }}>
            This link will expire in 7 days.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
