import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface EmptyStateProps {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("mx-auto grid max-w-md justify-items-center px-6 py-14 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink ring-1 ring-accent/15 [&_svg]:size-5">{icon}</span>
      <h2 className="m-0 mt-4 text-base font-bold tracking-tight text-ink">{title}</h2>
      {children && <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
