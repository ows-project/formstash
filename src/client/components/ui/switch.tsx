import { useId, type ComponentProps, type ReactNode } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../../lib/cn";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-line-strong p-0.5 transition-colors data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[18px] rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  );
}

interface SwitchRowProps extends ComponentProps<typeof SwitchPrimitive.Root> {
  label: ReactNode;
  description?: ReactNode;
}

// A full-width row whose label toggles the switch.
export function SwitchRow({ label, description, className, ...props }: SwitchRowProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-xl border border-line bg-surface-2/60 p-3.5", className)}>
      <label htmlFor={id} className="m-0 grid cursor-pointer gap-0.5">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {description && <span className="text-[13px] leading-snug text-muted">{description}</span>}
      </label>
      <Switch id={id} {...props} />
    </div>
  );
}
