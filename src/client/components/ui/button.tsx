import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,filter,scale,opacity] duration-150 ease-[var(--motion-ease)] motion-safe:active:scale-[0.98] select-none disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-gradient text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_8px_18px_-8px_rgb(15_79_201/0.7)] hover:brightness-110",
        secondary: "border border-line-strong bg-surface text-ink shadow-xs hover:border-accent/40 hover:bg-surface-2",
        ghost: "text-muted hover:bg-accent-soft hover:text-accent-ink",
        danger: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
        destructive: "bg-[#c01c3c] text-white shadow-[0_8px_18px_-8px_rgb(192_28_60/0.6)] hover:bg-[#a3152f]",
        glass: "border border-white/15 bg-white/10 text-white hover:bg-white/20",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
