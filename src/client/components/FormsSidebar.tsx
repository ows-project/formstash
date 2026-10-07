import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Link } from "wouter";
import type { FormSummary } from "../../shared/types";
import { cn } from "../lib/cn";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

interface FormsSidebarProps {
  forms: FormSummary[] | null;
  activeId?: string;
  onNewForm: () => void;
  className?: string;
}

export function FormsSidebar({ forms, activeId, onNewForm, className }: FormsSidebarProps) {
  const [query, setQuery] = useState("");
  const visible = forms?.filter((form) => form.name.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const activeIndex = visible.findIndex((form) => form.id === activeId);

  return (
    <div className={cn("flex min-h-0 flex-col gap-3 p-4", className)}>
      <div className="flex items-center justify-between gap-2 pl-1">
        <h2 className="m-0 text-sm font-bold text-ink">
          Forms {forms && <span className="ml-1 font-semibold text-subtle tabular-nums">{forms.length}</span>}
        </h2>
        <Button variant="secondary" size="sm" onClick={onNewForm}>
          <Plus /> New
        </Button>
      </div>
      {forms && forms.length > 4 && (
        <label className="relative block">
          <span className="sr-only">Search forms</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search forms"
            className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
          />
        </label>
      )}
      <nav aria-label="Forms" className="-mx-1 min-h-0 overflow-y-auto px-1 pb-2">
        <div className="relative grid gap-0.5">
          {activeIndex >= 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-xl bg-brand-gradient shadow-[0_10px_22px_-12px_rgb(15_79_201/0.9)] transition-transform duration-300 ease-[var(--motion-ease)]"
              // Match each h-10 row plus the gap-0.5 between rows.
              style={{ transform: `translateY(${activeIndex * 2.625}rem)` }}
            />
          )}
          {!forms && [0, 1, 2].map((key) => <Skeleton key={key} className="h-10 rounded-xl" />)}
          {visible.map((form) => {
            const active = form.id === activeId;
            return (
              <Link
                key={form.id}
                href={`/forms/${form.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-surface hover:text-ink",
                  active && "font-semibold text-white hover:bg-transparent hover:text-white",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{form.name}</span>
                {!form.isActive && (
                  <span className={cn("text-[11px] font-semibold", active ? "text-white/75" : "text-warning")}>Paused</span>
                )}
                {form.unreadCount > 0 && (
                  <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums", active ? "bg-white/20 text-white" : "bg-accent-soft text-accent-ink")}>
                    {form.unreadCount}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            );
          })}
          {forms && !visible.length && (
            <p className="m-0 px-3 py-2 text-[13px] text-muted">{forms.length ? `No forms match "${query.trim()}".` : "No forms yet."}</p>
          )}
        </div>
      </nav>
    </div>
  );
}
