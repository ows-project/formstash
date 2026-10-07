import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import type { FormSummary } from "../../../shared/types";
import { api } from "../../api";
import { errorMessage } from "../../lib/format";
import { useForms } from "../../components/FormsProvider";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { Input, Textarea } from "../../components/ui/input";
import { SwitchRow } from "../../components/ui/switch";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h3 className="m-0 border-b border-line pb-2 text-sm font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

interface FormSettingsDialogProps {
  form: FormSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fields stay uncontrolled and are read with FormData; Radix switches submit "on" when checked.
export function FormSettingsDialog({ form, open, onOpenChange }: FormSettingsDialogProps) {
  const { refreshForms } = useForms();
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
          name: data.get("name"),
          description: data.get("description"),
          fields: String(data.get("fields") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
          allowedOrigins: String(data.get("allowedOrigins") ?? "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          notificationEmail: data.get("notificationEmail"),
          successUrl: data.get("successUrl"),
          rateLimitPerMinute: Number(data.get("rateLimitPerMinute")),
          strictFields: data.get("strictFields") === "on",
          turnstileEnabled: data.get("turnstileEnabled") === "on",
          isActive: data.get("isActive") === "on",
        }),
      });
      await refreshForms();
      onOpenChange(false);
      toast.success("Form settings saved");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setError(""); onOpenChange(next); }}>
      <DialogContent size="lg">
        <form onSubmit={save} className="contents">
          <DialogHeader title="Form settings" description={`Choose how ${form.name} accepts and delivers submissions.`} />
          <DialogBody className="grid gap-8">
            {error && <Callout tone="danger">{error}</Callout>}
            <Section title="General">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Form name"><Input name="name" defaultValue={form.name} maxLength={80} required /></Field>
                <Field label="Description" optional><Input name="description" defaultValue={form.description} maxLength={240} /></Field>
              </div>
              <Field label="Fields" hint="Comma-separated keys. They set the inbox columns, the integration snippets, and what strict fields accepts.">
                <Input name="fields" defaultValue={form.fields.join(", ")} required className="font-mono text-[13px]" />
              </Field>
              <SwitchRow name="isActive" defaultChecked={form.isActive} label="Accept submissions" description="When off, the endpoint answers 404 and nothing is stored." />
            </Section>
            <Section title="Delivery">
              <div className="grid gap-4">
                <Field label="Notification email" optional hint="Emailed for each new submission once SMTP is set up in Settings.">
                  <Input name="notificationEmail" type="email" defaultValue={form.notificationEmail ?? ""} placeholder="you@example.com" />
                </Field>
                <Field label="Success redirect URL" optional hint="Where visitors land after submitting the HTML form.">
                  <Input name="successUrl" type="url" defaultValue={form.successUrl ?? ""} placeholder="https://example.com/thanks" />
                </Field>
              </div>
            </Section>
            <Section title="Protection">
              <Field label="Allowed origins" optional hint="One origin per line. Leave empty to accept submissions from any site.">
                <Textarea name="allowedOrigins" defaultValue={form.allowedOrigins.join("\n")} placeholder="https://example.com" className="min-h-20 font-mono text-[13px]" />
              </Field>
              <Field label="Rate limit per minute" hint="The most submissions one visitor can send each minute. 0 turns the limit off.">
                <Input name="rateLimitPerMinute" type="number" min={0} max={10000} defaultValue={form.rateLimitPerMinute} className="max-w-36" />
              </Field>
              <div className="grid gap-3">
                <SwitchRow name="strictFields" defaultChecked={form.strictFields} label="Strict fields" description="Reject submissions that contain keys not listed in Fields." />
                <SwitchRow name="turnstileEnabled" defaultChecked={form.turnstileEnabled} label="Require Turnstile" description="Every submission must carry a valid Cloudflare Turnstile token. Keys are set in Settings." />
              </div>
            </Section>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
