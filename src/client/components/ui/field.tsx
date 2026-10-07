import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface FieldProps {
  label: ReactNode;
  /** Set when the labelled element is nested inside the child, e.g. a Select's trigger. */
  id?: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
}

// Wires the label, hint, and error to a single control by id.
export function Field({ label, id, hint, error, optional, className, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? children.props.id ?? generated;
  const hintId = `${controlId}-hint`;
  const control = isValidElement(children)
    ? cloneElement(children, {
        ...(id ? {} : { id: controlId }),
        "aria-describedby": hint || error ? hintId : undefined,
        "aria-invalid": error ? true : undefined,
      })
    : children;
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={controlId} className="m-0 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-ink-2">
        {label}
        {optional && <span className="text-xs font-normal text-subtle">Optional</span>}
      </label>
      {control}
      {(hint || error) && (
        <p id={hintId} className={cn("m-0 text-xs leading-relaxed", error ? "text-danger" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
