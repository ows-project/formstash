import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import type { AppSettings, FormSummary } from "../../../shared/types";
import { api } from "../../api";
import { errorMessage } from "../../lib/format";
import {
  integrationWarnings,
  type IntegrationSettings,
} from "../../lib/snippets";
import { useForms } from "../../components/FormsProvider";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { DialogClose } from "../../components/ui/dialog";
import { Sheet, SheetContent } from "../../components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Field } from "../../components/ui/field";
import { Input, Textarea } from "../../components/ui/input";
import { SwitchRow } from "../../components/ui/switch";
import { SchemaEditor } from "./SchemaEditor";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h3 className="m-0 border-b border-line pb-2 text-sm font-bold text-ink">
        {title}
      </h3>
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
export function FormSettingsDialog({
  form,
  open,
  onOpenChange,
}: FormSettingsDialogProps) {
  const { refreshForms, removeForm } = useForms();
  const [, navigate] = useLocation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [turnstileOn, setTurnstileOn] = useState(form.turnstileEnabled);
  const [schemaOn, setSchemaOn] = useState(form.strictFields);
  const [schemaFields, setSchemaFields] = useState(form.schema);
  const [tab, setTab] = useState("general");
  const [appSettings, setAppSettings] = useState<IntegrationSettings | null>(
    null,
  );
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setTurnstileOn(form.turnstileEnabled);
    setSchemaOn(form.strictFields);
    setSchemaFields(form.schema);
    setTab("general");
    const controller = new AbortController();
    api<{ settings: AppSettings }>("/api/settings", {
      signal: controller.signal,
    })
      .then((result) => setAppSettings(result.settings))
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, form.turnstileEnabled, form.strictFields, form.schema]);

  const turnstileWarning = turnstileOn
    ? integrationWarnings(
        { ...form, turnstileEnabled: true },
        appSettings,
      ).find((warning) => warning.id === "turnstile-setup")
    : undefined;

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
          fields: String(data.get("fields") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          allowedOrigins: String(data.get("allowedOrigins") ?? "")
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter(Boolean),
          notificationEmail: data.get("notificationEmail"),
          successUrl: data.get("successUrl"),
          rateLimitPerMinute: Number(data.get("rateLimitPerMinute")),
          strictFields: schemaOn,
          schema: schemaFields,
          turnstileEnabled: data.get("turnstileEnabled") === "on",
          isActive: data.get("isActive") === "on",
        }),
      });
      await refreshForms();
      onOpenChange(false);
      toast.success("Form settings saved");
    } catch (caught) {
      setError(errorMessage(caught));
      bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  }

  async function deleteForm() {
    try {
      await api(`/api/forms/${form.id}`, { method: "DELETE" });
    } catch (caught) {
      toast.error(`Couldn't delete the form. ${errorMessage(caught)}`);
      throw caught;
    }
    onOpenChange(false);
    removeForm(form.id);
    navigate("/", { replace: true });
    toast.success("Form deleted permanently");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setError("");
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        title="Form settings"
        className="w-full sm:w-[600px]"
      >
        <form
          onSubmit={save}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
            <div>
              <h2 className="m-0 text-xl font-bold">Form settings</h2>
              <p className="mt-1 mb-0 text-sm text-muted">{form.name}</p>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close form settings"
              >
                <X />
              </Button>
            </DialogClose>
          </header>
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="mx-6 mb-4 shrink-0">
              <TabsTrigger value="general" className="flex-1">
                General
              </TabsTrigger>
              <TabsTrigger value="schema" className="flex-1">
                Schema
              </TabsTrigger>
              <TabsTrigger value="delivery" className="flex-1">
                Delivery
              </TabsTrigger>
              <TabsTrigger value="protection" className="flex-1">
                Protection
              </TabsTrigger>
            </TabsList>
            <div
              ref={bodyRef}
              className="min-h-0 flex-1 overflow-y-auto px-6 pb-6"
            >
              {error && <Callout tone="danger">{error}</Callout>}
              <TabsContent
                value="general"
                forceMount
                className="grid gap-6 data-[state=inactive]:hidden"
              >
                <Section title="General">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Form name">
                      <Input
                        name="name"
                        defaultValue={form.name}
                        maxLength={80}
                        required
                      />
                    </Field>
                    <Field label="Description" optional>
                      <Input
                        name="description"
                        defaultValue={form.description}
                        maxLength={240}
                      />
                    </Field>
                  </div>
                  <Field
                    label="Display fields"
                    optional
                    hint="Comma-separated keys for inbox columns and example snippets. These do not restrict submissions."
                  >
                    <Input
                      name="fields"
                      defaultValue={form.fields.join(", ")}
                      className="font-mono text-[13px]"
                    />
                  </Field>
                  <SwitchRow
                    name="isActive"
                    defaultChecked={form.isActive}
                    label="Accept submissions"
                    description="When off, the endpoint answers 404 and nothing is stored."
                  />
                </Section>
                <Section title="Delete form">
                  <p className="m-0 text-sm text-muted">
                    Permanently delete this form and all its submissions. This
                    cannot be undone.
                  </p>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={saving}
                    className="justify-self-start"
                    onClick={() => setDeleteOpen(true)}
                  >
                    Delete form
                  </Button>
                </Section>
              </TabsContent>
              <TabsContent
                value="schema"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <div className="grid gap-4">
                  <SwitchRow
                    checked={schemaOn}
                    onCheckedChange={setSchemaOn}
                    label="Enforce schema"
                    description="Drop unknown fields. Reject submissions that fail required fields, types, or validation."
                  />
                  {!schemaOn && (
                    <Callout tone="info">
                      All field names are accepted within the payload limits.
                      Saved schema rules are ignored until enforcement is on.
                    </Callout>
                  )}
                  <SchemaEditor
                    fields={schemaFields}
                    onChange={setSchemaFields}
                  />
                </div>
              </TabsContent>
              <TabsContent
                value="delivery"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <Section title="Delivery">
                  <div className="grid gap-4">
                    <Field
                      label="Notification email"
                      optional
                      hint="Emailed for each new submission once SMTP is set up in Settings."
                    >
                      <Input
                        name="notificationEmail"
                        type="email"
                        defaultValue={form.notificationEmail ?? ""}
                        placeholder="you@example.com"
                      />
                    </Field>
                    <Field
                      label="Success redirect URL"
                      optional
                      hint="Where visitors land after submitting the HTML form."
                    >
                      <Input
                        name="successUrl"
                        type="url"
                        defaultValue={form.successUrl ?? ""}
                        placeholder="https://example.com/thanks"
                      />
                    </Field>
                  </div>
                </Section>
              </TabsContent>
              <TabsContent
                value="protection"
                forceMount
                className="data-[state=inactive]:hidden"
              >
                <Section title="Protection">
                  <Field
                    label="Allowed origins"
                    optional
                    hint="One origin per line. Leave empty to accept submissions from any site."
                  >
                    <Textarea
                      name="allowedOrigins"
                      defaultValue={form.allowedOrigins.join("\n")}
                      placeholder="https://example.com"
                      className="min-h-20 font-mono text-[13px]"
                    />
                  </Field>
                  <Field
                    label="Rate limit per minute"
                    hint="The most submissions one visitor can send each minute. 0 turns the limit off."
                  >
                    <Input
                      name="rateLimitPerMinute"
                      type="number"
                      min={0}
                      max={10000}
                      defaultValue={form.rateLimitPerMinute}
                      className="max-w-36"
                    />
                  </Field>
                  <div className="grid gap-3">
                    <SwitchRow
                      name="turnstileEnabled"
                      defaultChecked={form.turnstileEnabled}
                      onCheckedChange={setTurnstileOn}
                      label="Require Turnstile"
                      description="Every submission must carry a valid Cloudflare Turnstile token. Keys are set in Settings."
                    />
                    {turnstileWarning && (
                      <Callout tone="warning" title={turnstileWarning.title}>
                        {turnstileWarning.body}
                      </Callout>
                    )}
                  </div>
                </Section>
              </TabsContent>
            </div>
          </Tabs>
          <footer className="flex shrink-0 justify-end gap-3 border-t border-line bg-surface px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </footer>
        </form>
      </SheetContent>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete form permanently?"
        description={
          <>
            “{form.name}” and all its submissions will be permanently deleted.
            Its endpoint will stop accepting submissions. This cannot be undone.
          </>
        }
        confirmLabel="Delete permanently"
        onConfirm={deleteForm}
      />
    </Sheet>
  );
}
