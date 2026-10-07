import { Link } from "wouter";
import type { FormSummary, Submission } from "../../../shared/types";
import { cn } from "../../lib/cn";
import { displayValue, formatDateTime, formatTime, humanizeField, sourceLabel, submissionTitle } from "../../lib/format";
import { SubmitterAvatar } from "../../components/SubmitterAvatar";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";

export function extraColumns(form: FormSummary): string[] {
  return form.fields.filter((field) => !["email", "name"].includes(field.toLowerCase())).slice(0, 2);
}

interface SubmissionListProps {
  form: FormSummary;
  submissions: Submission[] | null;
  selectedId: string | null;
  compact: boolean;
}

export function SubmissionList({ form, submissions, selectedId, compact }: SubmissionListProps) {
  const extras = extraColumns(form);
  const extraClass = cn("w-36 shrink-0 truncate max-xl:hidden", compact && "hidden");
  const sourceClass = cn("w-28 shrink-0 truncate max-md:hidden", compact && "max-2xl:hidden");

  return (
    <>
      <div className="flex h-10 shrink-0 items-center gap-4 border-b border-line bg-surface-2/60 px-4 text-xs font-semibold text-subtle sm:px-5" aria-hidden="true">
        <span className="min-w-0 flex-1 pl-[66px]">Contact</span>
        {extras.map((field) => <span key={field} className={extraClass}>{humanizeField(field)}</span>)}
        <span className={sourceClass}>Source</span>
        <span className="w-16 shrink-0 text-right">Received</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={submissions === null}>
        {submissions === null && Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex h-16 items-center gap-3 border-b border-line px-4 sm:px-5">
            <Skeleton className="size-9 rounded-full" />
            <div className="grid flex-1 gap-1.5"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-56" /></div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
        {submissions?.map((submission) => {
          const unread = submission.status === "unread";
          const title = submissionTitle(submission);
          const email = displayValue(submission.payload.email);
          const selected = submission.id === selectedId;
          return (
            <Link
              key={submission.id}
              href={`/forms/${form.id}/submissions/${submission.id}`}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "relative flex h-16 items-center gap-4 border-b border-line px-4 text-sm transition-colors hover:bg-surface-2 sm:px-5",
                selected && "bg-accent-soft shadow-[inset_3px_0_0_var(--accent)] hover:bg-accent-soft",
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className={cn("size-1.5 shrink-0 rounded-full", unread ? "bg-accent" : "bg-transparent")}>
                  {unread && <span className="sr-only">Unread</span>}
                </span>
                <SubmitterAvatar submission={submission} />
                <span className="min-w-0">
                  <span className={cn("block truncate", unread ? "font-bold text-ink" : "font-medium text-ink-2")}>{title}</span>
                  {email !== "—" && email !== title && <span className="block truncate text-[13px] text-muted">{email}</span>}
                </span>
                {submission.status === "spam" && <Badge tone="danger" className="ml-1">Spam</Badge>}
              </span>
              {extras.map((field) => <span key={field} className={cn(extraClass, "text-ink-2")}>{displayValue(submission.payload[field])}</span>)}
              <span className={cn(sourceClass, "text-muted")}>{sourceLabel(submission)}</span>
              <time dateTime={submission.receivedAt} title={formatDateTime(submission.receivedAt)} className={cn("w-16 shrink-0 text-right text-[13px] tabular-nums", unread ? "font-semibold text-ink-2" : "text-muted")}>
                {formatTime(submission.receivedAt)}
              </time>
            </Link>
          );
        })}
      </div>
    </>
  );
}
