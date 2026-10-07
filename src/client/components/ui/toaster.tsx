import { Toaster as Sonner } from "sonner";
import { useTheme } from "../ThemeProvider";

export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
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
