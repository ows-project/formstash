import { cn } from "../lib/cn";
import { CopyButton } from "./ui/copy-button";

export function CodeBlock({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl bg-terminal text-left ring-1 ring-white/10", className)}>
      <div className="flex h-10 items-center justify-between gap-3 border-b border-white/10 pr-1.5 pl-4">
        <span className="text-xs font-semibold text-terminal-ink/60">{label}</span>
        <CopyButton value={code} label="Copy" variant="glass" size="sm" className="h-7 border-transparent bg-transparent text-terminal-ink/80 hover:text-white" />
      </div>
      <pre className="m-0 max-h-[340px] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-terminal-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}
