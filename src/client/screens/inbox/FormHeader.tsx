import { Code2, Copy, Download, Settings } from "lucide-react";
import { toast } from "sonner";
import type { FormSummary } from "../../../shared/types";
import { cn } from "../../lib/cn";
import { endpointUrl } from "../../lib/snippets";
import { Button } from "../../components/ui/button";
import { LiveBadge } from "../../components/ui/badge";

interface FormHeaderProps {
  form: FormSummary;
  onIntegrate: () => void;
  onSettings: () => void;
}

export function EndpointChip({ slug, className }: { slug: string; className?: string }) {
  const url = endpointUrl(window.location.origin, slug);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Endpoint copied");
    } catch {
      toast.error("Couldn't copy to the clipboard. Select the URL and copy it manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn("group flex h-11 w-full max-w-2xl cursor-pointer items-center gap-3 rounded-xl bg-terminal pr-3 pl-1.5 text-left ring-1 ring-white/10 shadow-[0_14px_30px_-18px_rgb(3_11_34/0.9)] transition-shadow hover:ring-brand-400/50", className)}
      aria-label={`Copy endpoint ${url}`}
    >
      <span className="rounded-lg bg-brand-600 px-2 py-1 text-[11px] font-bold tracking-wide text-white">POST</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-terminal-ink">
        <span className="opacity-55 max-sm:hidden">{window.location.origin}</span>/f/{slug}
      </code>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-300 group-hover:text-white">
        <Copy className="size-3.5" />
        <span className="max-sm:sr-only">Copy</span>
      </span>
    </button>
  );
}

export function FormHeader({ form, onIntegrate, onSettings }: FormHeaderProps) {
  return (
    <header className="grid gap-4 px-4 pt-5 pb-4 sm:px-6 sm:pt-7">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 truncate text-[26px] leading-tight font-extrabold tracking-[-0.035em] text-ink sm:text-[30px]">{form.name}</h1>
            <LiveBadge live={form.isActive} />
          </div>
          <p className="m-0 mt-1 text-sm text-muted">{form.description || "No description yet."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onIntegrate}>
            <Code2 /> Integrate
          </Button>
          <Button variant="secondary" asChild>
            <a href={`/api/forms/${form.id}/export.csv`} download aria-label="Export CSV">
              <Download /> <span className="max-md:hidden">Export</span>
            </a>
          </Button>
          <Button variant="secondary" onClick={onSettings} aria-label="Form settings">
            <Settings /> <span className="max-md:hidden">Settings</span>
          </Button>
        </div>
      </div>
      <EndpointChip slug={form.slug} />
    </header>
  );
}
