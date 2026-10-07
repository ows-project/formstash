import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { cn } from "../../lib/cn";

const tones = {
  info: { className: "border-accent/20 bg-accent-soft text-ink-2 [&_svg]:text-accent-ink", Icon: Info },
  warning: { className: "border-warning/25 bg-warning-soft text-ink-2 [&_svg]:text-warning", Icon: TriangleAlert },
  danger: { className: "border-danger/25 bg-danger-soft text-ink-2 [&_svg]:text-danger", Icon: CircleAlert },
};

interface CalloutProps {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Callout({ tone = "info", title, children, className }: CalloutProps) {
  const { className: toneClass, Icon } = tones[tone];
  return (
    <div role={tone === "info" ? "note" : "alert"} className={cn("flex gap-3 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed", toneClass, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="m-0 font-semibold text-ink">{title}</p>}
        <div className="m-0">{children}</div>
      </div>
    </div>
  );
}
