import type { ReactNode } from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "../../lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
}

export function Segmented<T extends string>({ value, onValueChange, options, label, className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={label}
      className={cn("inline-flex h-10 items-center gap-1 rounded-xl border border-line bg-surface-2 p-1", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className="inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap text-muted transition-[background-color,color,box-shadow] duration-200 ease-[var(--motion-ease)] hover:text-ink data-[state=on]:bg-surface data-[state=on]:text-accent-ink data-[state=on]:shadow-[0_1px_3px_rgb(11_21_48/0.12)]"
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
