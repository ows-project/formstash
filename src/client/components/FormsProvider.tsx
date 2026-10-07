import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { FormSummary, SubmissionStatus } from "../../shared/types";
import { api } from "../api";
import { errorMessage } from "../lib/format";

interface FormsContextValue {
  /** `null` while the first load is in flight. */
  forms: FormSummary[] | null;
  /** Set when the first load failed; `forms` stays `null` until a retry succeeds. */
  loadError: string | null;
  refreshForms: () => Promise<FormSummary[] | null>;
  /** Optimistically move one submission between statuses; `null` means it was created or deleted. */
  adjustCounts: (formId: string, from: SubmissionStatus | null, to: SubmissionStatus | null) => void;
}

const FormsContext = createContext<FormsContextValue | null>(null);

function delta(status: SubmissionStatus | null, target: SubmissionStatus): number {
  return status === target ? 1 : 0;
}

export function FormsProvider({ children }: { children: ReactNode }) {
  const [forms, setForms] = useState<FormSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loaded = useRef(false);

  const refreshForms = useCallback(async () => {
    if (!loaded.current) setLoadError(null);
    try {
      const result = await api<{ forms: FormSummary[] }>("/api/forms");
      loaded.current = true;
      setForms(result.forms);
      return result.forms;
    } catch (error) {
      if (loaded.current) toast.error(`Couldn't refresh forms. ${errorMessage(error)}`);
      else setLoadError(errorMessage(error));
      return null;
    }
  }, []);

  const adjustCounts = useCallback((formId: string, from: SubmissionStatus | null, to: SubmissionStatus | null) => {
    setForms((current) => current?.map((form) => form.id !== formId ? form : {
      ...form,
      totalCount: form.totalCount + (to ? 1 : 0) - (from ? 1 : 0),
      unreadCount: form.unreadCount + delta(to, "unread") - delta(from, "unread"),
      spamCount: form.spamCount + delta(to, "spam") - delta(from, "spam"),
    }) ?? null);
  }, []);

  useEffect(() => { void refreshForms(); }, [refreshForms]);

  const value = useMemo(() => ({ forms, loadError, refreshForms, adjustCounts }), [forms, loadError, refreshForms, adjustCounts]);
  return <FormsContext.Provider value={value}>{children}</FormsContext.Provider>;
}

export function useForms(): FormsContextValue {
  const context = useContext(FormsContext);
  if (!context) throw new Error("useForms must be used inside FormsProvider");
  return context;
}
