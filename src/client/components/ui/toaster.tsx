import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="system"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl! border-line! bg-surface! text-ink! shadow-pop! font-sans!",
          description: "text-muted!",
          success: "[&_[data-icon]]:text-success!",
          error: "[&_[data-icon]]:text-danger!",
        },
      }}
    />
  );
}
