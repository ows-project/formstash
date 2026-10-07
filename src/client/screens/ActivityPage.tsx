import { useCallback, useEffect, useState } from "react";
import { Inbox, KeyRound, Mail, RefreshCw, Send } from "lucide-react";
import { Link } from "wouter";
import type { Delivery } from "../../shared/types";
import { api } from "../api";
import { cn } from "../lib/cn";
import { errorMessage, formatDateTime, formatTime } from "../lib/format";
import { PageHeading } from "../components/PageHeading";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Callout } from "../components/ui/callout";
import { EmptyState } from "../components/ui/empty-state";
import { Skeleton } from "../components/ui/skeleton";

const KINDS: Record<Delivery["kind"], { label: string; icon: typeof Inbox }> = {
  submission: { label: "New submission", icon: Inbox },
  password_reset: { label: "Password reset", icon: KeyRound },
  test: { label: "Test email", icon: Send },
};

const STATUSES: Record<Delivery["status"], { label: string; tone: "brand" | "warning" | "success" | "danger" }> = {
  queued: { label: "Queued", tone: "brand" },
  retrying: { label: "Retrying", tone: "warning" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

const columns = "md:grid md:grid-cols-[minmax(150px,1fr)_minmax(120px,0.9fr)_minmax(180px,1.4fr)_150px_96px] md:items-center md:gap-4";

export function ActivityPage() {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ deliveries: Delivery[] }>("/api/activity");
      setDeliveries(result.deliveries);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
      setDeliveries((current) => current ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-9">
        <PageHeading
          title="Email activity"
          description="Notifications, test emails, and password resets, with their delivery status."
          action={
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn(loading && "animate-spin")} /> Refresh
            </Button>
          }
        />
        {error && <Callout tone="danger" title="Couldn't load activity" className="mb-4">{error}</Callout>}
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <div className={cn("hidden h-10 border-b border-line bg-surface-2/60 px-5 text-xs font-semibold text-subtle", columns)} aria-hidden="true">
            <span>Email</span><span>Form</span><span>Recipient</span><span>Status</span><span className="text-right">Created</span>
          </div>
          {deliveries === null && [0, 1, 2, 3].map((key) => (
            <div key={key} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-5 w-20 rounded-full" /></div>
          ))}
          {deliveries?.map((delivery) => {
            const kind = KINDS[delivery.kind];
            const status = STATUSES[delivery.status];
            const KindIcon = kind.icon;
            return (
              <div key={delivery.id} className="border-b border-line px-5 py-3.5 last:border-0">
                <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1", columns)}>
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <KindIcon className="size-4 shrink-0 text-subtle" /> {kind.label}
                  </span>
                  <span className="truncate text-sm text-ink-2 max-md:hidden">{delivery.formName ?? "—"}</span>
                  <span className="col-start-1 truncate text-sm text-muted md:col-start-auto md:text-ink-2">{delivery.recipient}</span>
                  <span className="col-start-2 row-span-2 row-start-1 flex flex-col items-end gap-1 md:col-start-auto md:row-span-1 md:row-start-auto md:flex-row md:items-center md:justify-start md:gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {delivery.attempts > 1 && <span className="text-xs text-muted">{delivery.attempts} attempts</span>}
                  </span>
                  <time dateTime={delivery.createdAt} title={formatDateTime(delivery.createdAt)} className="text-xs text-muted md:text-right md:text-[13px]">
                    {formatTime(delivery.createdAt)}
                  </time>
                </div>
                {delivery.lastError && delivery.status !== "delivered" && (
                  <p className="m-0 mt-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] break-words text-danger">{delivery.lastError}</p>
                )}
              </div>
            );
          })}
          {deliveries?.length === 0 && !error && (
            <EmptyState
              icon={<Mail />}
              title="No emails yet"
              action={<Button variant="secondary" asChild><Link href="/settings">Set up email delivery</Link></Button>}
            >
              Submission notifications, test emails, and password resets appear here once SMTP is set up.
            </EmptyState>
          )}
        </div>
      </div>
    </main>
  );
}
