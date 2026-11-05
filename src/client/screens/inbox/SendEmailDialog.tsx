import { useEffect, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { FormSummary, Submission } from "../../../shared/types";
import { api } from "../../api";
import { displayValue, errorMessage, formatDateTime, submissionTitle } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Segmented } from "../../components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

interface SendEmailDialogProps {
  form: FormSummary;
  /** One submission to email; without it, many submissions of the form. */
  submission?: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

export function SendEmailDialog({ form, submission, open, onOpenChange, onSent }: SendEmailDialogProps) {
  const [, navigate] = useLocation();
  const [templateId, setTemplateId] = useState("");
  const [audience, setAudience] = useState<"pending" | "all">("pending");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const template = form.templates.find((entry) => entry.id === templateId);

  useEffect(() => {
    if (open) {
      setTemplateId((current) => form.templates.some((entry) => entry.id === current) ? current : form.templates[0]?.id ?? "");
      setAudience("pending");
      setError("");
    }
  }, [open, form.templates]);

  // Manual variables start from the template's saved defaults.
  useEffect(() => {
    setValues(Object.fromEntries((template?.variables ?? []).filter((variable) => variable.source === "manual").map((variable) => [variable.key, variable.value])));
  }, [template]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!template) return;
    setSending(true);
    setError("");
    try {
      const result = await api<{ queued: number; skipped: number }>(`/api/forms/${form.id}/templates/${template.id}/send`, {
        method: "POST",
        body: JSON.stringify({ submissionId: submission?.id, audience, variables: values }),
      });
      onOpenChange(false);
      onSent();
      toast.success(result.queued === 1 ? `“${template.name}” queued` : `${result.queued} emails queued`, {
        description: result.skipped ? `${result.skipped} skipped without a valid email in "${form.recipientField}".` : "Delivery status appears in Activity.",
        action: { label: "View activity", onClick: () => navigate("/activity") },
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  const recipient = submission ? displayValue(submission.payload[form.recipientField]) : null;
  const alreadySent = submission?.sentTemplates.filter((sent) => sent.templateId === templateId).at(-1);
  const manual = template?.variables.filter((variable) => variable.source === "manual") ?? [];
  const mapped = template?.variables.filter((variable) => variable.source === "field") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={send} className="contents">
          <DialogHeader
            title="Send email"
            description={submission
              ? `To ${submissionTitle(submission)}${recipient !== "—" && recipient !== submissionTitle(submission) ? ` (${recipient})` : ""}`
              : "To the people who submitted this form. Spam is skipped."}
          />
          <DialogBody className="grid gap-4">
            <Field label="Template" id="send-template">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="send-template"><SelectValue placeholder="Choose a template" /></SelectTrigger>
                <SelectContent>
                  {form.templates.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {!submission && (
              <div className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-ink-2">Recipients</span>
                <Segmented
                  label="Recipients"
                  value={audience}
                  onValueChange={setAudience}
                  className="justify-self-start"
                  options={[{ value: "pending", label: "Not sent this template yet" }, { value: "all", label: "Everyone" }]}
                />
              </div>
            )}
            {alreadySent && (
              <Callout tone="warning">This submission already received “{template?.name}” on {formatDateTime(alreadySent.sentAt)}. Sending again emails them a second time.</Callout>
            )}
            {manual.length > 0 && (
              <div className="grid gap-3">
                {manual.map((variable) => (
                  <Field key={variable.key} label={<code className="font-mono">{variable.key}</code>}>
                    <Input value={values[variable.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [variable.key]: event.target.value }))} />
                  </Field>
                ))}
              </div>
            )}
            {template && (
              <p className="m-0 text-xs text-muted">
                {mapped.length > 0 && <>{mapped.map((variable) => `${variable.key} ← ${variable.value}`).join(", ")}. </>}
                Submission fields are also sent under their own names. Resend template <code className="font-mono">{template.resendTemplate}</code>.
              </p>
            )}
            {error && <Callout tone="danger">{error}</Callout>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" disabled={sending || !template}><Send /> {sending ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
