import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { FormSummary, SubmissionStatus } from "../../shared/types";
import { api } from "../api";
import { errorMessage } from "../lib/format";

interface FormsContextValue {
  /** `null` while the first load is in flight. */
  forms: FormSummary[] | null;
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

  const refreshForms = useCallback(async () => {
    try {
      const result = await api<{ forms: FormSummary[] }>("/api/forms");
      setForms(result.forms);
      return result.forms;
    } catch (error) {
      toast.error(`Couldn't load forms. ${errorMessage(error)}`);
      setForms((current) => current ?? []);
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

  const value = useMemo(() => ({ forms, refreshForms, adjustCounts }), [forms, refreshForms, adjustCounts]);
  return <FormsContext.Provider value={value}>{children}</FormsContext.Provider>;
}

export function useForms(): FormsContextValue {
  const context = useContext(FormsContext);
  if (!context) throw new Error("useForms must be used inside FormsProvider");
  return context;
}
