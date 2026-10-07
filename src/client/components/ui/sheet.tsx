import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "../../lib/cn";
import { overlayClass, useRestoreFocus } from "./dialog";

export const Sheet = DialogPrimitive.Root;

export function SheetContent({ className, children, title, onOpenAutoFocus, onCloseAutoFocus, ...props }: ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  const focus = useRestoreFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(320px,88vw)] flex-col bg-canvas shadow-pop outline-none",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
          className,
        )}
        {...props}
        {...focus}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
