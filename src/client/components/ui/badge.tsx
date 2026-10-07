import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-muted ring-1 ring-line ring-inset",
      brand: "bg-accent-soft text-accent-ink",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning",
      danger: "bg-danger-soft text-danger",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function LiveBadge({ live }: { live: boolean }) {
  return live ? (
    <Badge tone="success">
      <span className="size-1.5 animate-live rounded-full bg-[#12b76a]" />
      Live
    </Badge>
  ) : (
    <Badge tone="warning">
      <span className="size-1.5 rounded-full bg-current" />
      Paused
    </Badge>
  );
}
