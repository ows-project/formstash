import { useState, type ReactNode } from "react";
import { Collapsible } from "radix-ui";
import { ArrowLeft, Braces, ChevronDown, CloudOff, FileQuestion, Mail, MailOpen, ShieldAlert, ShieldCheck, Trash2, X } from "lucide-react";
import type { Submission, SubmissionStatus } from "../../../shared/types";
import { displayValue, formatDateTime, formatTime, humanizeField, mailtoHref, submissionTitle } from "../../lib/format";
import { CodeBlock } from "../../components/CodeBlock";
import { SubmitterAvatar } from "../../components/SubmitterAvatar";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { EmptyState } from "../../components/ui/empty-state";
import { Skeleton } from "../../components/ui/skeleton";

const STATUS_BADGE: Record<SubmissionStatus, { tone: "brand" | "neutral" | "danger"; label: string }> = {
  unread: { tone: "brand", label: "Unread" },
  read: { tone: "neutral", label: "Read" },
  spam: { tone: "danger", label: "Spam" },
};

interface SubmissionDetailProps {
  submission: Submission | null;
  state: "ready" | "loading" | "missing" | "error";
  error?: string;
  onRetry: () => void;
  fieldOrder: string[];
  onClose: () => void;
  onStatus: (submission: Submission, status: SubmissionStatus) => void;
  onDelete: (submission: Submission) => Promise<void>;
}

function orderedEntries(submission: Submission, fieldOrder: string[]) {
  const keys = Object.keys(submission.payload);
  const known = fieldOrder.filter((field) => keys.includes(field));
  return [...known, ...keys.filter((key) => !known.includes(key))].map((key) => [key, submission.payload[key]] as const);
}

function DetailBar({ onClose, children }: { onClose: () => void; children?: ReactNode }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3 sm:px-4">
      <Button variant="ghost" size="sm" className="xl:hidden" onClick={onClose}>
        <ArrowLeft /> Inbox
      </Button>
      {children}
      <Button variant="ghost" size="icon-sm" className="ml-auto max-xl:hidden" onClick={onClose} aria-label="Close submission">
        <X />
      </Button>
    </div>
  );
}

export function SubmissionDetail({ submission, state, error, onRetry, fieldOrder, onClose, onStatus, onDelete }: SubmissionDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (state === "loading" || !submission) {
    return (
      <>
        <DetailBar onClose={onClose} />
        {state === "loading" ? (
          <div className="grid gap-6 p-6" aria-busy="true">
            <div className="flex items-center gap-4"><Skeleton className="size-13 rounded-full" /><div className="grid flex-1 gap-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-3.5 w-36" /></div></div>
            {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-10" />)}
          </div>
        ) : state === "error" ? (
          <EmptyState icon={<CloudOff />} title="Couldn't load this submission" action={<Button onClick={onRetry}>Try again</Button>}>
            {error}
          </EmptyState>
        ) : (
          <EmptyState icon={<FileQuestion />} title="Submission not found" action={<Button variant="secondary" onClick={onClose}>Back to inbox</Button>}>
            It may have been deleted, or the link points to a different form.
          </EmptyState>
        )}
      </>
    );
  }

  const badge = STATUS_BADGE[submission.status];
  const title = submissionTitle(submission);
  const email = displayValue(submission.payload.email);
  const emailHref = mailtoHref(submission.payload.email);
  const raw = JSON.stringify(submission.payload, null, 2);

  return (
    <>
      <DetailBar onClose={onClose}>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </DetailBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-4 px-5 pt-6 pb-5 sm:px-6">
          <SubmitterAvatar submission={submission} size="lg" />
          <div className="min-w-0">
            <h2 className="m-0 truncate text-xl font-extrabold tracking-[-0.025em] text-ink">{title}</h2>
            {email !== "—" && email !== title && (emailHref
              ? <a href={emailHref} className="block truncate text-sm font-medium text-accent-ink hover:underline">{email}</a>
              : <p className="m-0 truncate text-sm text-ink-2">{email}</p>)}
            <time dateTime={submission.receivedAt} title={formatDateTime(submission.receivedAt)} className="mt-0.5 block text-[13px] text-muted">
              Received {formatTime(submission.receivedAt)}
            </time>
          </div>
        </div>

        <dl className="m-0 mx-5 divide-y divide-line rounded-2xl border border-line sm:mx-6">
          {orderedEntries(submission, fieldOrder).map(([key, value]) => (
            <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
              <dt className="text-[13px] font-medium text-muted">{humanizeField(key)}</dt>
              <dd className="m-0 text-sm break-words whitespace-pre-wrap text-ink">{displayValue(value)}</dd>
            </div>
          ))}
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-[13px] font-medium text-muted">Source</dt>
            <dd className="m-0 text-sm break-all text-ink">
              {submission.sourceUrl ? (
                <a href={submission.sourceUrl} target="_blank" rel="noreferrer" className="text-accent-ink hover:underline">{submission.sourceUrl}</a>
              ) : "Direct"}
            </dd>
          </div>
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-[13px] font-medium text-muted">Received</dt>
            <dd className="m-0 text-sm text-ink">{formatDateTime(submission.receivedAt)}</dd>
          </div>
        </dl>

        <Collapsible.Root className="mx-5 my-5 sm:mx-6">
          <Collapsible.Trigger className="group flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-1 text-sm font-semibold text-ink-2 hover:text-ink">
            <Braces className="size-4 text-subtle" /> Raw JSON
            <ChevronDown className="ml-auto size-4 text-subtle transition-transform group-data-[state=open]:rotate-180" />
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-1">
            <CodeBlock label="Payload" code={raw} />
          </Collapsible.Content>
        </Collapsible.Root>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface-2/60 p-3 sm:px-4">
        {submission.status !== "spam" && (
          <Button variant="secondary" size="sm" onClick={() => onStatus(submission, submission.status === "unread" ? "read" : "unread")}>
            {submission.status === "unread" ? <><MailOpen /> Mark read</> : <><Mail /> Mark unread</>}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => onStatus(submission, submission.status === "spam" ? "read" : "spam")}>
          {submission.status === "spam" ? <><ShieldCheck /> Not spam</> : <><ShieldAlert /> Mark spam</>}
        </Button>
        <Button variant="danger" size="sm" className="ml-auto" onClick={() => setConfirmDelete(true)}>
          <Trash2 /> Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this submission?"
        description={`The submission from ${title} will be permanently removed. This can't be undone.`}
        confirmLabel="Delete submission"
        onConfirm={() => onDelete(submission)}
      />
    </>
  );
}
