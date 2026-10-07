import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Archive, Mail, Save, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { AppSettings } from "../../shared/types";
import { api } from "../api";
import { errorMessage } from "../lib/format";
import { PageHeading } from "../components/PageHeading";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Callout } from "../components/ui/callout";
import { Field } from "../components/ui/field";
import { Input, PasswordInput } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";

interface SettingsCardProps {
  icon: typeof Mail;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
}

function SettingsCard({ icon: Icon, title, description, aside, children }: SettingsCardProps) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-lift sm:p-6">
      <div className="mb-6 flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink ring-1 ring-accent/15">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-bold tracking-tight text-ink">{title}</h2>
          <p className="m-0 mt-0.5 text-sm text-muted">{description}</p>
        </div>
        {aside}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

// Uncontrolled fields read through FormData; the form mounts only after settings load.
export function SettingsPage() {
  const [, navigate] = useLocation();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const result = await api<{ settings: AppSettings }>("/api/settings");
    setSettings(result.settings);
  }, []);

  useEffect(() => {
    load().catch((error) => setLoadError(errorMessage(error)));
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          smtpEnabled: data.get("smtpEnabled") === "on",
          smtpHost: data.get("smtpHost"),
          smtpPort: Number(data.get("smtpPort")),
          smtpSecurity: data.get("smtpSecurity"),
          smtpUsername: data.get("smtpUsername"),
          smtpPassword: data.get("smtpPassword"),
          smtpFromName: data.get("smtpFromName"),
          smtpFromEmail: data.get("smtpFromEmail"),
          turnstileSiteKey: data.get("turnstileSiteKey"),
          turnstileSecret: data.get("turnstileSecret"),
          retentionDays: Number(data.get("retentionDays")),
        }),
      });
      await load();
      for (const name of ["smtpPassword", "turnstileSecret"]) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement) input.value = "";
      }
      toast.success("Settings saved");
    } catch (error) {
      toast.error(`Couldn't save settings. ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      await api("/api/settings/test-email", { method: "POST" });
      toast.success("Test email queued", {
        description: "Delivery status appears in Activity.",
        action: { label: "View activity", onClick: () => navigate("/activity") },
      });
    } catch (error) {
      toast.error(`Couldn't send a test email. ${errorMessage(error)}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-7 sm:px-6 sm:pt-9">
        <PageHeading title="Settings" description="Email delivery, spam protection, and how long submissions are kept." />
        {loadError && <Callout tone="danger" title="Couldn't load settings">{loadError}</Callout>}
        {!settings && !loadError && (
          <div className="grid gap-6" aria-busy="true">
            {[0, 1, 2].map((key) => <Skeleton key={key} className="h-56 rounded-2xl" />)}
          </div>
        )}
        {settings && (
          <form onSubmit={save} className="grid gap-6">
            {!settings.encryptionReady && (
              <Callout tone="warning" title="Set APP_SECRET first">
                SMTP and Turnstile credentials are encrypted with the <code className="font-mono text-[12px]">APP_SECRET</code> Worker secret. Add it before saving either one.
              </Callout>
            )}

            <SettingsCard
              icon={Mail}
              title="Email delivery"
              description="Send new-submission notifications and password resets through your SMTP server."
              aside={<Switch name="smtpEnabled" defaultChecked={settings.smtpEnabled} aria-label="Send email" className="mt-2" />}
            >
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px_190px]">
                <Field label="SMTP host"><Input name="smtpHost" defaultValue={settings.smtpHost} placeholder="smtp.example.com" /></Field>
                <Field label="Port"><Input name="smtpPort" type="number" min={1} max={65535} defaultValue={settings.smtpPort} /></Field>
                <Field label="Security">
                  <Select name="smtpSecurity" defaultValue={settings.smtpSecurity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tls">TLS (port 465)</SelectItem>
                      <SelectItem value="starttls">STARTTLS (port 587)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Username"><Input name="smtpUsername" defaultValue={settings.smtpUsername} autoComplete="off" /></Field>
                <Field label="Password" hint={settings.smtpPasswordConfigured ? "Saved. Leave blank to keep it." : undefined}>
                  <PasswordInput name="smtpPassword" autoComplete="new-password" placeholder={settings.smtpPasswordConfigured ? "••••••••••" : "SMTP password"} />
                </Field>
                <Field label="From name"><Input name="smtpFromName" defaultValue={settings.smtpFromName} placeholder="Formstash" /></Field>
                <Field label="From email"><Input name="smtpFromEmail" type="email" defaultValue={settings.smtpFromEmail} placeholder="forms@example.com" /></Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
                <p className="m-0 text-[13px] text-muted">Save your changes first, then send a test to your owner email.</p>
                <Button type="button" variant="secondary" size="sm" onClick={sendTest} disabled={testing}>
                  <Send /> {testing ? "Sending…" : "Send test email"}
                </Button>
              </div>
            </SettingsCard>

            <SettingsCard
              icon={ShieldCheck}
              title="Turnstile"
              description="Cloudflare Turnstile keys, shared by every form that requires a token."
              aside={settings.turnstileSiteKey && settings.turnstileSecretConfigured ? <Badge tone="success">Configured</Badge> : undefined}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Site key"><Input name="turnstileSiteKey" defaultValue={settings.turnstileSiteKey} className="font-mono text-[13px]" placeholder="0x4AAAAAAA…" /></Field>
                <Field label="Secret key" hint={settings.turnstileSecretConfigured ? "Saved. Leave blank to keep it." : undefined}>
                  <PasswordInput name="turnstileSecret" autoComplete="new-password" placeholder={settings.turnstileSecretConfigured ? "••••••••••" : "Turnstile secret"} />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard icon={Archive} title="Data retention" description="Expired submissions are deleted every day at 03:00 UTC.">
              <div className="grid gap-1.5">
                <label htmlFor="retention-days" className="m-0 text-[13px] font-semibold text-ink-2">Keep submissions for</label>
                <div className="flex items-center gap-2">
                  <Input id="retention-days" name="retentionDays" type="number" min={0} max={3650} defaultValue={settings.retentionDays} aria-describedby="retention-hint" className="max-w-28" />
                  <span className="text-sm text-muted">days</span>
                </div>
                <p id="retention-hint" className="m-0 text-xs text-muted">Enter 0 to keep submissions forever.</p>
              </div>
            </SettingsCard>

            <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-line bg-canvas/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
              <Button type="submit" disabled={saving}>
                <Save /> {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
