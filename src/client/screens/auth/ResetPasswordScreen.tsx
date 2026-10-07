import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { errorMessage } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Field } from "../../components/ui/field";
import { PasswordInput } from "../../components/ui/input";
import { AuthCard, AuthHeading, AuthLayout } from "./AuthLayout";

export function ResetPasswordScreen({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) return setError("The passwords don't match.");
    setSubmitting(true);
    setError("");
    try {
      await api("/api/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      onComplete();
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard>
        <form onSubmit={submit}>
          <AuthHeading title="Choose a new password">Use at least 12 characters. You'll sign in with it next.</AuthHeading>
          <div className="grid gap-5">
            <Field label="New password">
              <PasswordInput autoFocus autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            <Field label="Confirm password">
              <PasswordInput autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            </Field>
            {error && <Callout tone="danger">{error}</Callout>}
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>{submitting ? "Saving…" : "Save new password"}</Button>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
