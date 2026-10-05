import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Mail, RefreshCw, Save, Send, Settings2, ShieldCheck, X } from "lucide-react";
import type { AppSettings, Delivery, FormSummary } from "../shared/types";
import { api } from "./api";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const result = await api<{ settings: AppSettings }>("/api/settings");
    setSettings(result.settings);
  }

  useEffect(() => { load().catch((caught) => setError(errorMessage(caught))); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setNotice("");
    const data = new FormData(form);
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
      setNotice("Settings saved");
      form.querySelector<HTMLInputElement>('input[name="smtpPassword"]')!.value = "";
      form.querySelector<HTMLInputElement>('input[name="turnstileSecret"]')!.value = "";
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function testEmail() {
    setError("");
    setNotice("");
    try {
      await api("/api/settings/test-email", { method: "POST" });
      setNotice("Test email queued. Check Activity for delivery status.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (!settings) return <main className="management-page"><p className="page-loading">Loading settings…</p></main>;

  return (
    <main className="management-page">
      <div className="management-heading"><div><h1>Settings</h1><p>Configure delivery, abuse protection, and data lifecycle.</p></div></div>
      <form className="settings-form" onSubmit={save}>
        {!settings.encryptionReady && <div className="warning-banner"><ShieldCheck size={18} /><span>Set the <code>APP_SECRET</code> Worker secret before saving SMTP or Turnstile credentials.</span></div>}
        {notice && <div className="success-banner"><CheckCircle2 size={18} />{notice}</div>}
        {error && <div className="error-banner">{error}</div>}

        <section className="settings-card">
          <div className="settings-card-head"><div className="settings-icon"><Mail size={19} /></div><div><h2>SMTP delivery</h2><p>Send form notifications and password resets through your mail server.</p></div><label className="switch"><input name="smtpEnabled" type="checkbox" defaultChecked={settings.smtpEnabled} /><span /></label></div>
          <div className="settings-grid three">
            <label>SMTP host<input name="smtpHost" defaultValue={settings.smtpHost} placeholder="smtp.example.com" /></label>
            <label>Port<input name="smtpPort" type="number" min="1" max="65535" defaultValue={settings.smtpPort} /></label>
            <label>Security<select name="smtpSecurity" defaultValue={settings.smtpSecurity}><option value="tls">TLS (465)</option><option value="starttls">STARTTLS (587)</option></select></label>
          </div>
          <div className="settings-grid two">
            <label>Username<input name="smtpUsername" defaultValue={settings.smtpUsername} autoComplete="off" /></label>
            <label>Password<input name="smtpPassword" type="password" autoComplete="new-password" placeholder={settings.smtpPasswordConfigured ? "Configured — leave blank to keep" : "SMTP password"} /></label>
            <label>From name<input name="smtpFromName" defaultValue={settings.smtpFromName} /></label>
            <label>From email<input name="smtpFromEmail" type="email" defaultValue={settings.smtpFromEmail} /></label>
          </div>
          <button className="secondary-button" type="button" onClick={testEmail}><Send size={16} /> Send test email</button>
        </section>

        <section className="settings-card">
          <div className="settings-card-head"><div className="settings-icon"><ShieldCheck size={19} /></div><div><h2>Turnstile</h2><p>Credentials are shared by forms that enable Turnstile verification.</p></div></div>
          <div className="settings-grid two">
            <label>Site key<input name="turnstileSiteKey" defaultValue={settings.turnstileSiteKey} /></label>
            <label>Secret key<input name="turnstileSecret" type="password" autoComplete="new-password" placeholder={settings.turnstileSecretConfigured ? "Configured — leave blank to keep" : "Turnstile secret"} /></label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-head"><div className="settings-icon"><Settings2 size={19} /></div><div><h2>Data retention</h2><p>Expired submissions are removed daily at 03:00 UTC.</p></div></div>
          <label className="compact-field">Keep submissions for<input name="retentionDays" type="number" min="0" max="3650" defaultValue={settings.retentionDays} /><span>days</span><small>Use 0 to keep submissions indefinitely.</small></label>
        </section>

        <div className="settings-save"><button className="primary-button" disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save settings"}</button></div>
      </form>
    </main>
  );
}

export function ActivityPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const result = await api<{ deliveries: Delivery[] }>("/api/activity");
      setDeliveries(result.deliveries);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  return (
    <main className="management-page">
      <div className="management-heading"><div><h1>Email activity</h1><p>Queue attempts and SMTP delivery results.</p></div><button className="secondary-button" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
      {error && <div className="error-banner">{error}</div>}
      <section className="activity-card">
        <div className="activity-columns"><span>Type</span><span>Form</span><span>Recipient</span><span>Status</span><span>Created</span></div>
        {deliveries.map((delivery) => (
          <div className="activity-row" key={delivery.id} title={delivery.lastError ?? undefined}>
            <span className="activity-kind">{delivery.kind.replace("_", " ")}</span><span>{delivery.formName ?? "—"}</span><strong>{delivery.recipient}</strong><span><i className={`delivery-status ${delivery.status}`}>{delivery.status}</i>{delivery.attempts > 0 && <small>{delivery.attempts} attempt{delivery.attempts === 1 ? "" : "s"}</small>}</span><time>{new Date(delivery.createdAt).toLocaleString()}</time>
          </div>
        ))}
        {!loading && !deliveries.length && <div className="empty-state"><span><Mail size={23} /></span><h2>No email activity</h2><p>Submission notifications, tests, and password resets will appear here.</p></div>}
        {loading && <p className="page-loading">Loading activity…</p>}
      </section>
    </main>
  );
}

export function FormSettingsModal({ form, onClose, onSaved }: { form: FormSummary; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`/api/forms/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.get("name"), description: data.get("description"),
          fields: String(data.get("fields") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
          allowedOrigins: String(data.get("allowedOrigins") ?? "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          notificationEmail: data.get("notificationEmail"), successUrl: data.get("successUrl"),
          rateLimitPerMinute: Number(data.get("rateLimitPerMinute")),
          strictFields: data.get("strictFields") === "on", turnstileEnabled: data.get("turnstileEnabled") === "on",
          isActive: data.get("isActive") === "on",
        }),
      });
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal form-settings-modal" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><h2>Form settings</h2><p>Configure schema, notifications, and protection.</p></div><button className="icon-button" type="button" onClick={onClose}><X size={18} /></button></div>
        {error && <div className="error-banner">{error}</div>}
        <div className="settings-grid two"><label>Form name<input name="name" defaultValue={form.name} required /></label><label>Notification email<input name="notificationEmail" type="email" defaultValue={form.notificationEmail ?? ""} /></label></div>
        <label>Description<input name="description" defaultValue={form.description} /></label>
        <label>Fields<input name="fields" defaultValue={form.fields.join(", ")} required /><small>Comma-separated field keys used for display and strict validation.</small></label>
        <label>Allowed origins<textarea name="allowedOrigins" defaultValue={form.allowedOrigins.join("\n")} placeholder="https://example.com" /><small>One origin per line. Empty accepts submissions from any origin.</small></label>
        <div className="settings-grid two"><label>Success redirect URL<input name="successUrl" type="url" defaultValue={form.successUrl ?? ""} /></label><label>Rate limit / minute<input name="rateLimitPerMinute" type="number" min="0" max="10000" defaultValue={form.rateLimitPerMinute} /></label></div>
        <div className="checkbox-stack">
          <label><input name="isActive" type="checkbox" defaultChecked={form.isActive} /><span><strong>Active</strong><small>Accept new submissions.</small></span></label>
          <label><input name="strictFields" type="checkbox" defaultChecked={form.strictFields} /><span><strong>Strict fields</strong><small>Reject fields that are not in the schema.</small></span></label>
          <label><input name="turnstileEnabled" type="checkbox" defaultChecked={form.turnstileEnabled} /><span><strong>Require Turnstile</strong><small>Verify `_turnstile` or `cf-turnstile-response` on every submission.</small></span></label>
        </div>
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save form"}</button></div>
      </form>
    </div>
  );
}
