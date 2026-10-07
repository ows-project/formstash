import { useEffect, useState } from "react";
import type { AppSettings, FormSummary } from "../../../shared/types";
import { api } from "../../api";
import { curlSnippet, endpointUrl, fetchSnippet, htmlSnippet, integrationWarnings, type IntegrationSettings, type IntegrationWarning } from "../../lib/snippets";
import { CodeBlock } from "../../components/CodeBlock";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { EndpointChip } from "./FormHeader";

interface IntegrationDialogProps {
  form: FormSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSettings: () => void;
}

function Warnings({ warnings, onOpenSettings }: { warnings: IntegrationWarning[]; onOpenSettings?: () => void }) {
  return warnings.map((warning) => (
    <Callout key={warning.id} tone={warning.tone} title={warning.title}>
      {warning.body}
      {onOpenSettings && warning.id === "no-success-url" && (
        <div className="mt-2.5">
          <Button variant="secondary" size="sm" onClick={onOpenSettings}>Open form settings</Button>
        </div>
      )}
    </Callout>
  ));
}

export function IntegrationDialog({ form, open, onOpenChange, onOpenSettings }: IntegrationDialogProps) {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api<{ settings: AppSettings }>("/api/settings", { signal: controller.signal })
      .then((result) => setSettings(result.settings))
      .catch(() => undefined);
    return () => controller.abort();
  }, [open]);

  const input = { endpoint: endpointUrl(window.location.origin, form.slug), form, turnstileSiteKey: settings?.turnstileSiteKey };
  const warnings = integrationWarnings(form, settings);
  const pick = (...ids: IntegrationWarning["id"][]) => warnings.filter((warning) => ids.includes(warning.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader title="Connect your form" description="Send submissions to this endpoint from any website or server." />
        <DialogBody className="grid gap-4">
          <EndpointChip slug={form.slug} className="max-w-none" />
          <Warnings warnings={pick("paused", "turnstile-setup", "strict")} />
          <Tabs defaultValue="html" className="mt-1">
            <TabsList className="max-sm:flex max-sm:w-full [&>*]:max-sm:flex-1">
              <TabsTrigger value="html">HTML form</TabsTrigger>
              <TabsTrigger value="fetch">JavaScript</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>
            <TabsContent value="html" className="mt-4 grid gap-3">
              <p className="m-0 text-sm text-muted">Paste this into any page. It works without JavaScript and includes a hidden spam trap.</p>
              <CodeBlock label="HTML form" code={htmlSnippet(input)} />
              <Warnings warnings={pick("no-success-url", "origins")} onOpenSettings={onOpenSettings} />
            </TabsContent>
            <TabsContent value="fetch" className="mt-4 grid gap-3">
              <p className="m-0 text-sm text-muted">Call this from your own submit handler. Formstash answers with JSON: 201 and the submission id, or an error message.</p>
              <CodeBlock label="JavaScript fetch" code={fetchSnippet(input)} />
              <Warnings warnings={pick("origins")} />
            </TabsContent>
            <TabsContent value="curl" className="mt-4 grid gap-3">
              <p className="m-0 text-sm text-muted">Test the endpoint from a terminal, or call it from your server.</p>
              <CodeBlock label="cURL command" code={curlSnippet(input)} />
              {form.turnstileEnabled && (
                <Callout tone="info" title="cURL can't pass Turnstile">
                  This form requires a Turnstile token, which only a browser can produce. Turn Turnstile off in form settings to test from a terminal.
                </Callout>
              )}
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
