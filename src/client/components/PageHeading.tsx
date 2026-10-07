import type { ReactNode } from "react";

export function PageHeading({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="m-0 text-[28px] leading-tight font-extrabold tracking-[-0.035em] text-ink">{title}</h1>
        <p className="m-0 mt-1 text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
