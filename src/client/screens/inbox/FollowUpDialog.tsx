import { useEffect, useState, type FormEvent } from "react";
import { Plus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { FormSummary, Submission } from "../../../shared/types";
import { api } from "../../api";
import { displayValue, errorMessage, submissionTitle } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";

interface Variable { key: string; value: string }

interface FollowUpDialogProps {
  form: FormSummary;
  /** One submission to email; without it, every submission that has not had a follow-up. */
  submission?: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}

// The same link usually goes to everyone, so the last variables are remembered per form.
const storageKey = (formId: string) => `formstash:follow-up-variables:${formId}`;

function savedVariables(formId: string): Variable[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(formId)) ?? "null") as Variable[] | null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch { /* fall through to the default row */ }
  return [{ key: "link", value: "" }];
}

export function FollowUpDialog({ form, submission, open, onOpenChange, onSent }: FollowUpDialogProps) {
  const [, navigate] = useLocation();
  const [variables, setVariables] = useState<Variable[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVariables(savedVariables(form.id));
    setError("");
  }, [open, form.id]);

  const update = (index: number, change: Partial<Variable>) =>
    setVariables((rows) => rows.map((row, position) => position === index ? { ...row, ...change } : row));

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filled = variables.map((row) => ({ key: row.key.trim(), value: row.value })).filter((row) => row.key || row.value);
    if (filled.some((row) => !row.key)) return setError("Every value needs a variable name.");
    setSending(true);
    setError("");
    try {
      const result = await api<{ queued: number; skipped: number }>(`/api/forms/${form.id}/follow-ups`, {
        method: "POST",
        body: JSON.stringify({
          submissionId: submission?.id,
          variables: Object.fromEntries(filled.map((row) => [row.key, row.value])),
        }),
      });
      localStorage.setItem(storageKey(form.id), JSON.stringify(filled));
      onOpenChange(false);
      onSent();
      toast.success(result.queued === 1 ? "Follow-up queued" : `${result.queued} follow-ups queued`, {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={send} className="contents">
          <DialogHeader
            title="Send follow-up"
            description={submission
              ? <>To {submissionTitle(submission)}{recipient !== "—" && recipient !== submissionTitle(submission) ? ` (${recipient})` : ""}</>
              : "To every submission that hasn't received a follow-up yet. Spam is skipped."}
          />
          <DialogBody className="grid gap-4">
            {submission?.followUpAt && (
              <Callout tone="warning">This submission already received a follow-up. Sending again emails them a second time.</Callout>
            )}
            <div className="grid gap-2">
              <p className="m-0 text-[13px] font-semibold text-ink-2">Template variables</p>
              <p className="m-0 text-xs text-muted">
                Added to the submission fields for template <code className="font-mono">{form.followUpTemplate}</code>. Use them in Resend as <code className="font-mono">{"{{{link}}}"}</code>.
              </p>
              {variables.map((row, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
                  <Input aria-label="Variable name" value={row.key} onChange={(event) => update(index, { key: event.target.value })} placeholder="link" className="font-mono text-[13px]" />
                  <Input aria-label="Value" value={row.value} onChange={(event) => update(index, { value: event.target.value })} placeholder="https://play.google.com/apps/testing/…" />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove variable" onClick={() => setVariables((rows) => rows.filter((_, position) => position !== index))}>
                    <X />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" className="justify-self-start" onClick={() => setVariables((rows) => [...rows, { key: "", value: "" }])}>
                <Plus /> Add variable
              </Button>
            </div>
            {error && <Callout tone="danger">{error}</Callout>}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button type="submit" disabled={sending}><Send /> {sending ? "Sending…" : submission ? "Send follow-up" : "Send to all pending"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
