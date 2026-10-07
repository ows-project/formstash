import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/cn";

export const fieldControl =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-xs transition-[border-color,box-shadow] placeholder:text-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:border-danger disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldControl, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldControl, "min-h-24 resize-y py-2.5 leading-relaxed", className)} {...props} />;
}

export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 grid w-10 cursor-pointer place-items-center rounded-r-lg text-subtle hover:text-ink"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
