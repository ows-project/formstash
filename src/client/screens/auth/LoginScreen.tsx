import { useState, type FormEvent } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api } from "../../api";
import { errorMessage } from "../../lib/format";
import type { UserInfo } from "../../auth";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Field } from "../../components/ui/field";
import { Input, PasswordInput } from "../../components/ui/input";
import { AuthCard, AuthHeading, AuthLayout } from "./AuthLayout";

export function LoginScreen({ onLogin, notice }: { onLogin: (user: UserInfo) => void; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "forgot" | "requested">("sign-in");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ user: UserInfo }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onLogin(result.user);
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/api/auth/password/request", { method: "POST", body: JSON.stringify({ email }) });
      setMode("requested");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function backToSignIn() {
    setMode("sign-in");
    setError("");
  }

  return (
    <AuthLayout>
      <AuthCard>
        {mode === "sign-in" && (
          <form onSubmit={signIn}>
            <AuthHeading title="Sign in to Formstash">Manage your forms and review new submissions.</AuthHeading>
            <div className="grid gap-5">
              {notice && <Callout tone="info">{notice}</Callout>}
              <Field label="Email address">
                <Input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </Field>
              <div className="grid gap-1.5">
                <Field label="Password">
                  <PasswordInput autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                </Field>
                <button type="button" className="ml-auto cursor-pointer text-xs font-semibold text-accent-ink hover:underline" onClick={() => { setError(""); setMode("forgot"); }}>
                  Forgot password?
                </button>
              </div>
              {error && <Callout tone="danger">{error}</Callout>}
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</Button>
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={requestReset}>
            <Button type="button" variant="ghost" size="sm" className="-mt-2 mb-3 -ml-3" onClick={backToSignIn}><ArrowLeft /> Back to sign in</Button>
            <AuthHeading title="Reset your password">We'll email you a link that works for one hour. It's sent through the SMTP server configured in Settings.</AuthHeading>
            <div className="grid gap-5">
              <Field label="Email address">
                <Input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </Field>
              {error && <Callout tone="danger">{error}</Callout>}
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>{submitting ? "Sending…" : "Send reset link"}</Button>
            </div>
          </form>
        )}

        {mode === "requested" && (
          <div className="grid justify-items-start">
            <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-success-soft text-success"><MailCheck className="size-5" /></span>
            <AuthHeading title="Check your email">If an account exists for {email}, a reset link is on its way. It expires in one hour.</AuthHeading>
            <Button type="button" variant="secondary" className="w-full" onClick={backToSignIn}>Back to sign in</Button>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
