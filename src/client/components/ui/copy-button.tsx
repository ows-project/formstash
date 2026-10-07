import { useEffect, useState, type ComponentProps } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";

interface CopyButtonProps extends Omit<ComponentProps<typeof Button>, "onClick" | "children"> {
  value: string;
  label?: string;
  copiedMessage?: string;
}

export function CopyButton({ value, label, copiedMessage, variant = "secondary", size = "sm", ...props }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copiedMessage) toast.success(copiedMessage);
    } catch {
      toast.error("Couldn't copy to the clipboard. Select the text and copy it manually.");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={copy} aria-label={label ? undefined : copied ? "Copied" : "Copy"} {...props}>
      {copied ? <Check className="motion-enter" /> : <Copy className="motion-enter" />}
      {label && (copied ? "Copied" : label)}
    </Button>
  );
}
