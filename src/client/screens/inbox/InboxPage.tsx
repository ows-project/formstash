import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, Inbox, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { FormSummary, Submission, SubmissionStatus } from "../../../shared/types";
import { api, ApiError } from "../../api";
import { cn } from "../../lib/cn";
import { errorMessage } from "../../lib/format";
import { curlSnippet, endpointUrl } from "../../lib/snippets";
import { CodeBlock } from "../../components/CodeBlock";
import { useForms } from "../../components/FormsProvider";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { EmptyState } from "../../components/ui/empty-state";
import { Segmented } from "../../components/ui/segmented";
import { Tooltip } from "../../components/ui/tooltip";
import { FormHeader } from "./FormHeader";
import { FormSettingsDialog } from "./FormSettingsDialog";
import { IntegrationDialog } from "./IntegrationDialog";
import { SubmissionDetail } from "./SubmissionDetail";
import { SubmissionList } from "./SubmissionList";

type Filter = "all" | SubmissionStatus;

const STATUS_TOAST: Record<SubmissionStatus, string> = {
  read: "Marked as read",
  unread: "Marked as unread",
  spam: "Moved to spam",
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Keyed by form id, so switching forms starts with fresh filters and list.
export function InboxPage({ form, submissionId }: { form: FormSummary; submissionId: string | null }) {
  const [, navigate] = useLocation();
  const { adjustCounts, refreshForms } = useForms();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim(), 250);
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [fetched, setFetched] = useState<{ id: string; submission: Submission | null; error?: string } | null>(null);
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoRead = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams();
    if (filter !== "all") parameters.set("status", filter);
    if (search) parameters.set("q", search);
    setListError("");
    api<{ submissions: Submission[] }>(`/api/forms/${form.id}/submissions?${parameters}`, { signal: controller.signal })
      .then((result) => setSubmissions(result.submissions))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setListError(errorMessage(error));
        setSubmissions((current) => current ?? []);
      });
    return () => controller.abort();
  }, [form.id, filter, search, reloadKey]);

  const listed = submissionId ? submissions?.find((entry) => entry.id === submissionId) : undefined;

  // A linked submission can be outside the loaded page or the active filter.
  useEffect(() => {
    if (!submissionId || submissions === null || listed || fetched?.id === submissionId) return;
    const controller = new AbortController();
    api<{ submission: Submission }>(`/api/forms/${form.id}/submissions/${submissionId}`, { signal: controller.signal })
      .then((result) => setFetched({ id: submissionId, submission: result.submission }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        const missing = error instanceof ApiError && error.status === 404;
        setFetched({ id: submissionId, submission: null, error: missing ? undefined : errorMessage(error) });
      });
    return () => controller.abort();
  }, [form.id, submissionId, submissions, listed, fetched?.id]);

  const selected = listed ?? (fetched?.id === submissionId ? fetched.submission : null);
  const detailState = !submissionId ? null
    : selected ? "ready"
    : fetched?.id !== submissionId ? "loading"
    : fetched.error ? "error"
    : "missing";

  const applyStatus = useCallback((id: string, status: SubmissionStatus) => {
    setSubmissions((entries) => entries?.map((entry) => entry.id === id ? { ...entry, status } : entry) ?? null);
    setFetched((current) => current?.submission?.id === id ? { ...current, submission: { ...current.submission, status } } : current);
  }, []);

  const updateStatus = useCallback(async (submission: Submission, status: SubmissionStatus, options: { quiet?: boolean } = {}) => {
    const previous = submission.status;
    if (previous === status) return;
    applyStatus(submission.id, status);
    adjustCounts(form.id, previous, status);
    try {
      await api(`/api/forms/${form.id}/submissions/${submission.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (!options.quiet) {
        toast.success(STATUS_TOAST[status], {
          action: { label: "Undo", onClick: () => void updateStatus({ ...submission, status }, previous, { quiet: true }) },
        });
      }
    } catch (error) {
      applyStatus(submission.id, previous);
      adjustCounts(form.id, status, previous);
      toast.error(`Couldn't update the submission. ${errorMessage(error)}`);
    } finally {
      void refreshForms();
    }
  }, [form.id, applyStatus, adjustCounts, refreshForms]);

  useEffect(() => {
    if (!selected || selected.status !== "unread" || autoRead.current.has(selected.id)) return;
    autoRead.current.add(selected.id);
    void updateStatus(selected, "read", { quiet: true });
  }, [selected, updateStatus]);

  async function deleteSubmission(submission: Submission) {
    try {
      await api(`/api/forms/${form.id}/submissions/${submission.id}`, { method: "DELETE" });
    } catch (error) {
      toast.error(`Couldn't delete the submission. ${errorMessage(error)}`);
      throw error;
    }
    setSubmissions((entries) => entries?.filter((entry) => entry.id !== submission.id) ?? null);
    setFetched((current) => current?.id === submission.id ? { id: current.id, submission: null } : current);
    adjustCounts(form.id, submission.status, null);
    navigate(`/forms/${form.id}`, { replace: true });
    toast.success("Submission deleted");
    void refreshForms();
  }

  function refresh() {
    setReloadKey((key) => key + 1);
    void refreshForms();
  }

  const closeDetail = () => navigate(`/forms/${form.id}`);
  const filtered = filter !== "all" || search !== "";

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col", submissionId && "max-xl:hidden")}>
        <FormHeader form={form} onIntegrate={() => setIntegrationOpen(true)} onSettings={() => setSettingsOpen(true)} />

        <div className="flex flex-col gap-3 px-4 pb-3 sm:flex-row sm:items-center sm:px-6">
          <label className="relative block sm:w-72 lg:w-80">
            <span className="sr-only">Search submissions</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search submissions"
              className="h-10 w-full rounded-xl border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink shadow-xs placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
            />
          </label>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Segmented
              label="Filter submissions"
              value={filter}
              onValueChange={setFilter}
              className="flex-1 sm:flex-none"
              options={[
                { value: "all", label: <>All <span className="font-medium text-subtle tabular-nums">{form.totalCount}</span></> },
                { value: "unread", label: <>Unread <span className="font-medium text-subtle tabular-nums">{form.unreadCount}</span></> },
                { value: "spam", label: <>Spam <span className="font-medium text-subtle tabular-nums">{form.spamCount}</span></> },
              ]}
            />
            <Tooltip content="Check for new submissions">
              <Button variant="secondary" size="icon" onClick={refresh} aria-label="Refresh">
                <RefreshCw />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="mx-4 mb-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift sm:mx-6 sm:mb-6">
          {listError && (
            <div className="border-b border-line p-3">
              <Callout tone="danger" title="Couldn't load submissions">
                {listError} <button type="button" className="cursor-pointer font-semibold text-accent-ink underline" onClick={refresh}>Try again</button>
              </Callout>
            </div>
          )}
          {submissions !== null && submissions.length === 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {search ? (
                <EmptyState icon={<Search />} title={`No submissions match "${search}"`}>Try a different word, or clear the search.</EmptyState>
              ) : filter === "unread" ? (
                <EmptyState icon={<CheckCheck />} title="You're all caught up">New submissions will show up here unread.</EmptyState>
              ) : filter === "spam" ? (
                <EmptyState icon={<ShieldCheck />} title="No spam">Submissions that fill in the hidden spam trap land here instead of your inbox.</EmptyState>
              ) : (
                <EmptyState
                  icon={<Inbox />}
                  title="Waiting for your first submission"
                  className="max-w-xl"
                  action={<Button onClick={() => setIntegrationOpen(true)}>Open integration guide</Button>}
                >
                  <p className="m-0 mb-4">Send a test from your terminal and it appears here.</p>
                  {!form.isActive && (
                    <Callout tone="warning" className="mb-3 text-left">This form is paused, so the endpoint won't accept submissions until you turn it back on in form settings.</Callout>
                  )}
                  <div className="text-left">
                    <CodeBlock label="cURL example" code={curlSnippet({ endpoint: endpointUrl(window.location.origin, form.slug), form })} />
                  </div>
                </EmptyState>
              )}
            </div>
          ) : (
            <SubmissionList form={form} submissions={submissions} selectedId={submissionId} compact={!!submissionId} />
          )}
          {filtered && submissions && submissions.length >= 100 && (
            <p className="m-0 border-t border-line px-5 py-2.5 text-xs text-muted">Showing the 100 most recent matches.</p>
          )}
          {!filtered && submissions && submissions.length >= 100 && (
            <p className="m-0 border-t border-line px-5 py-2.5 text-xs text-muted">Showing the 100 most recent submissions. Export CSV to get all of them.</p>
          )}
        </div>
      </section>

      {submissionId && detailState && (
        <aside className="flex min-h-0 w-full flex-col border-line bg-surface xl:w-[min(460px,38%)] xl:shrink-0 xl:border-l xl:shadow-[-18px_0_40px_-30px_rgb(11_21_48/0.35)]" aria-label="Submission">
          <SubmissionDetail
            key={submissionId}
            submission={selected}
            state={detailState}
            error={fetched?.id === submissionId ? fetched.error : undefined}
            onRetry={() => setFetched(null)}
            fieldOrder={form.fields}
            onClose={closeDetail}
            onStatus={(submission, status) => void updateStatus(submission, status)}
            onDelete={deleteSubmission}
          />
        </aside>
      )}

      <IntegrationDialog form={form} open={integrationOpen} onOpenChange={setIntegrationOpen} onOpenSettings={() => { setIntegrationOpen(false); setSettingsOpen(true); }} />
      <FormSettingsDialog form={form} open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
