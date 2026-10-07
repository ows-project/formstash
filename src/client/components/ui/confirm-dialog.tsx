import { useState, type ReactNode } from "react";
import { AlertDialog } from "radix-ui";
import { cn } from "../../lib/cn";
import { Button, buttonVariants } from "./button";
import { overlayClass, useRestoreFocus } from "./dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const focus = useRestoreFocus({});

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the failure; keep the dialog open so the action can be retried.
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClass} />
        <AlertDialog.Content
          {...focus}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-6 text-ink shadow-pop",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97] data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        >
          <AlertDialog.Title className="m-0 text-lg font-bold tracking-tight">{title}</AlertDialog.Title>
          <AlertDialog.Description className="m-0 mt-2 text-sm leading-relaxed text-muted">{description}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className={buttonVariants({ variant: "secondary" })}>Cancel</AlertDialog.Cancel>
            <Button variant="destructive" disabled={busy} onClick={confirm}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
