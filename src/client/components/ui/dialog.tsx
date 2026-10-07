import { useRef, type ComponentProps, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

// Our dialogs open from state, not Dialog.Trigger, so Radix has no trigger to
// refocus on close. Remember whatever had focus on open and return to it.
export function useRestoreFocus({ onOpenAutoFocus, onCloseAutoFocus }: { onOpenAutoFocus?: (event: Event) => void; onCloseAutoFocus?: (event: Event) => void }) {
  const opener = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus(event: Event) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus(event: Event) {
      onCloseAutoFocus?.(event);
      if (event.defaultPrevented || !opener.current?.isConnected) return;
      event.preventDefault();
      opener.current.focus();
    },
  };
}

export const overlayClass =
  "motion-layer fixed inset-0 z-50 bg-[#030b22]/55 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0";

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
}

// Put a <form className="contents"> directly inside so its fields and
// submit button share the portaled DOM subtree.
export function DialogContent({ className, children, size = "md", hideClose, onOpenAutoFocus, onCloseAutoFocus, ...props }: DialogContentProps) {
  const focus = useRestoreFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClass} />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-pop outline-none",
          "motion-layer data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97]",
          size === "sm" && "max-w-md",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-3xl",
          className,
        )}
        {...props}
        {...focus}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute top-4 right-4 grid size-8 cursor-pointer place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ title, description, className }: { title: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <div className={cn("shrink-0 px-6 pt-6 pr-14 pb-4", className)}>
      <DialogPrimitive.Title className="m-0 text-lg font-bold tracking-tight text-ink">{title}</DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="m-0 mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/70 px-6 py-4", className)} {...props} />;
}
