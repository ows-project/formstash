import { CopyButton } from "./ui/copy-button";

export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-terminal ring-1 ring-white/10">
      <pre className="m-0 max-h-[340px] overflow-auto p-4 pr-24 font-mono text-[12.5px] leading-relaxed text-terminal-ink" aria-label={label}>
        <code>{code}</code>
      </pre>
      <CopyButton value={code} label="Copy" variant="glass" size="sm" className="absolute top-2.5 right-2.5" />
    </div>
  );
}
