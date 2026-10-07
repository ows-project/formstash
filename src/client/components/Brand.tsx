import { cn } from "../lib/cn";

export function Brand({ tone = "default", className }: { tone?: "default" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[17px] font-extrabold tracking-tight", tone === "light" ? "text-white" : "text-ink", className)}>
      <span className={cn("grid size-9 place-items-center rounded-[11px]", tone === "light" && "bg-white shadow-[0_6px_16px_-6px_rgb(3_11_34/0.6)]")}>
        <img src="/formstash-icon.svg" alt="" className={tone === "light" ? "size-7" : "size-8"} />
      </span>
      Formstash
    </span>
  );
}
