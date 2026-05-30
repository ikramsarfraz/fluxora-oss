"use client";

import { Copy, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteTenantSsoProviderAction,
  saveTenantSsoProviderAction,
  type TenantSsoConnection,
} from "@/modules/core/workspace-settings/actions";
import {
  SSO_PROVISION_ROLES,
  type SsoProtocol,
  type SsoProvisionRole,
} from "@/modules/core/workspace-settings/services/sso-settings.schema";

function CopyableUrl({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border-default bg-surface px-2 py-1.5 text-[12px] text-ink-warm">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard
              .writeText(value)
              .then(() => toast.success(`${label} copied`))
              .catch(() => toast.error("Could not copy"));
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SsoSettingsCard({
  connection,
}: {
  connection: TenantSsoConnection;
}) {
  const [isPending, startTransition] = useTransition();

  const [protocol, setProtocol] = useState<SsoProtocol>(
    connection.protocol ?? "oidc",
  );
  const [defaultRole, setDefaultRole] = useState<SsoProvisionRole>(
    connection.defaultRole,
  );
  const [enforceSsoOnly, setEnforceSsoOnly] = useState(
    connection.enforceSsoOnly,
  );
  const [displayLabel, setDisplayLabel] = useState(
    connection.displayLabel ?? "",
  );

  // OIDC fields
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scopes, setScopes] = useState("");

  // SAML fields
  const [idpIssuer, setIdpIssuer] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [idpCertificate, setIdpCertificate] = useState("");

  function onSave() {
    const base = {
      protocol,
      defaultRole,
      enforceSsoOnly,
      displayLabel: displayLabel.trim() || undefined,
    };
    const payload =
      protocol === "oidc"
        ? { ...base, issuer, clientId, clientSecret, scopes: scopes || undefined }
        : { ...base, idpIssuer, idpSsoUrl, idpCertificate };

    startTransition(async () => {
      try {
        await saveTenantSsoProviderAction(payload);
        toast.success("SSO connection saved");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not save the SSO connection.",
        );
      }
    });
  }

  function onRemove() {
    startTransition(async () => {
      try {
        await deleteTenantSsoProviderAction();
        toast.success("SSO connection removed");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not remove the connection.",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Single Sign-On</CardTitle>
            <CardDescription>
              Let your team sign in through your identity provider (SAML 2.0 or
              OIDC). New users are provisioned automatically on first login.
            </CardDescription>
          </div>
          {connection.configured ? (
            <Badge variant="secondary">
              {connection.protocol?.toUpperCase()} ·{" "}
              {connection.status === "active" ? "Active" : "Disabled"}
            </Badge>
          ) : (
            <Badge variant="outline">Not configured</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* IdP-facing endpoints */}
        <section className="space-y-3 rounded-md border border-border-default p-3">
          <h3 className="text-sm font-medium">Give these to your IdP</h3>
          <CopyableUrl
            label="Redirect / Callback URL (OIDC)"
            value={connection.endpoints.oidcRedirectUrl}
          />
          <CopyableUrl
            label="Assertion Consumer Service / ACS (SAML)"
            value={connection.endpoints.acsUrl}
          />
          <CopyableUrl
            label="SP Metadata URL (SAML)"
            value={connection.endpoints.spMetadataUrl}
          />
        </section>

        <Separator />

        {/* Protocol */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sso-protocol">Protocol</Label>
            <Select
              value={protocol}
              onValueChange={v => setProtocol(v as SsoProtocol)}
            >
              <SelectTrigger id="sso-protocol" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oidc">OIDC</SelectItem>
                <SelectItem value="saml">SAML 2.0</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sso-default-role">Default role for new users</Label>
            <Select
              value={defaultRole}
              onValueChange={v => setDefaultRole(v as SsoProvisionRole)}
            >
              <SelectTrigger id="sso-default-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SSO_PROVISION_ROLES.map(role => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Protocol-specific fields */}
        {protocol === "oidc" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="oidc-issuer">Issuer URL</Label>
              <Input
                id="oidc-issuer"
                value={issuer}
                onChange={e => setIssuer(e.target.value)}
                placeholder="https://acme.okta.com"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="oidc-client-id">Client ID</Label>
                <Input
                  id="oidc-client-id"
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oidc-client-secret">Client secret</Label>
                <Input
                  id="oidc-client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={e => setClientSecret(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oidc-scopes">Scopes (optional)</Label>
              <Input
                id="oidc-scopes"
                value={scopes}
                onChange={e => setScopes(e.target.value)}
                placeholder="openid email profile"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="saml-issuer">IdP issuer / EntityID</Label>
              <Input
                id="saml-issuer"
                value={idpIssuer}
                onChange={e => setIdpIssuer(e.target.value)}
                placeholder="https://idp.example.com/entity"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saml-sso-url">IdP SSO URL</Label>
              <Input
                id="saml-sso-url"
                value={idpSsoUrl}
                onChange={e => setIdpSsoUrl(e.target.value)}
                placeholder="https://idp.example.com/sso/saml"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="saml-cert">IdP signing certificate (x509)</Label>
              <Textarea
                id="saml-cert"
                value={idpCertificate}
                onChange={e => setIdpCertificate(e.target.value)}
                rows={5}
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
              />
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sso-label">Sign-in button label (optional)</Label>
            <Input
              id="sso-label"
              value={displayLabel}
              onChange={e => setDisplayLabel(e.target.value)}
              placeholder="Sign in with Okta"
            />
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox
              checked={enforceSsoOnly}
              onCheckedChange={v => setEnforceSsoOnly(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Require SSO</span>
              <span className="block text-xs text-muted-foreground">
                Hide email and Google sign-in for this workspace. Platform
                admins keep a recovery path.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {connection.configured ? "Update connection" : "Save connection"}
          </Button>
          {connection.configured ? (
            <Button variant="outline" onClick={onRemove} disabled={isPending}>
              Remove
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
