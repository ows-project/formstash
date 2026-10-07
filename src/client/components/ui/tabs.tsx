import type { ComponentProps } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "../../lib/cn";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex h-10 items-center gap-1 rounded-xl border border-line bg-surface-2 p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap text-muted transition-colors hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-accent-ink data-[state=active]:shadow-[0_1px_3px_rgb(11_21_48/0.12)]",
        className,
      )}
      {...props}
    />
  );
}
