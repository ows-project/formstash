import { useState, type FormEvent } from "react";
import { ArrowLeft, BotOff, Braces, ShieldCheck } from "lucide-react";
import { api } from "../../api";
import { cn } from "../../lib/cn";
import { errorMessage } from "../../lib/format";
import type { UserInfo } from "../../auth";
import { Brand } from "../../components/Brand";
import { Button } from "../../components/ui/button";
import { Callout } from "../../components/ui/callout";
import { Field } from "../../components/ui/field";
import { Input, PasswordInput } from "../../components/ui/input";
import { AuthCard, AuthHeading, AuthLayout } from "./AuthLayout";

const BENEFITS = [
  { icon: ShieldCheck, label: "One owner, no public sign-ups" },
  { icon: Braces, label: "Works with any frontend" },
  { icon: BotOff, label: "Spam trap and Turnstile built in" },
];

function TrayIllustration() {
  return (
    <div className="relative mt-14 h-[220px] w-full max-w-[420px]" aria-hidden="true">
      <div className="absolute top-0 left-8 inline-flex items-center gap-2 rounded-full bg-terminal/70 px-3 py-1.5 font-mono text-xs text-terminal-ink ring-1 ring-white/15">
        <span className="font-bold text-brand-300">POST</span>/f/waiting-list
      </div>
            <div className="absolute inset-x-12 top-[64px] animate-tray-drop rounded-2xl bg-white p-4 text-[#0b1530] shadow-[0_18px_40px_-16px_rgb(3_11_34/0.8)]">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,#6d4ae8,#4325b8)] text-xs font-bold text-white">AL</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-bold">Ada Lovelace</p>
            <p className="m-0 text-xs text-[#5b6b8c]">ada@example.com</p>
          </div>
          <span className="rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[11px] font-bold text-[#0f4fc9]">New</span>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[96px] rounded-t-xl rounded-b-[34px] bg-[linear-gradient(180deg,rgb(91_153_255/0.85),rgb(15_79_201/0.95)_60%,rgb(7_51_143))] shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_24px_50px_-20px_rgb(3_11_34/0.9)]">
        <div className="absolute inset-x-0 top-0 h-6 rounded-t-xl bg-white/15" />
        <div className="absolute inset-x-[34%] top-6 h-2.5 rounded-b-full bg-brand-950/35" />
      </div>
    </div>
  );
}

function SetupAside() {
  return (
    <>
      <Brand tone="light" />
      <div className="my-auto max-w-[560px] py-10">
        <h1 className="m-0 text-[clamp(40px,4.1vw,58px)] leading-[1.02] font-extrabold tracking-[-0.045em]">
          Collect form submissions without running a server.
        </h1>
        <p className="m-0 mt-5 max-w-[470px] text-[17px] leading-relaxed text-brand-100/85">
          Point any HTML form or fetch call at Formstash. Submissions land in an inbox that lives in your own Cloudflare account.
        </p>
        <TrayIllustration />
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {BENEFITS.map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium text-brand-50 ring-1 ring-white/15">
            <Icon className="size-4 text-brand-300" /> {label}
          </li>
        ))}
      </ul>
    </>
  );
}

export function SetupScreen({ onComplete }: { onComplete: (user: UserInfo, formId: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formName, setFormName] = useState("Waiting list");
  const [description, setDescription] = useState("Collect early access signups.");
  const [allowedOrigin, setAllowedOrigin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function continueSetup(event: FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 12) return setError("Use at least 12 characters for your password.");
    setError("");
    setStep(2);
  }

  async function finishSetup(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ user: UserInfo; formId: string }>("/api/setup", {
        method: "POST",
        body: JSON.stringify({ email, password, formName, description, allowedOrigin }),
      });
      onComplete(result.user, result.formId);
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout aside={<SetupAside />}>
      <AuthCard>
        <div className="mb-7 flex items-center gap-3">
          <div className="grid flex-1 grid-cols-2 gap-1.5" aria-hidden="true">
            <span className="h-1.5 rounded-full bg-accent" />
            <span className={cn("h-1.5 rounded-full transition-colors", step === 2 ? "bg-accent" : "bg-line")} />
          </div>
          <span className="text-xs font-semibold text-accent-ink">Step {step} of 2</span>
        </div>

        {step === 1 ? (
          <form onSubmit={continueSetup} noValidate>
            <AuthHeading title="Create your owner account">This account is the only one that can sign in to this Formstash instance.</AuthHeading>
            <div className="grid gap-5">
              <Field label="Email address">
                <Input autoFocus type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </Field>
              <Field label="Password" hint="At least 12 characters.">
                <PasswordInput autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} required />
              </Field>
              {error && <Callout tone="danger">{error}</Callout>}
              <Button type="submit" size="lg" className="w-full">Continue</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={finishSetup}>
            <Button type="button" variant="ghost" size="sm" className="-mt-2 mb-3 -ml-3" onClick={() => { setError(""); setStep(1); }}>
              <ArrowLeft /> Back
            </Button>
            <AuthHeading title="Create your first form">Each form gets its own endpoint and inbox. You can change all of this later.</AuthHeading>
            <div className="grid gap-5">
              <Field label="Form name">
                <Input autoFocus value={formName} onChange={(event) => setFormName(event.target.value)} maxLength={80} required />
              </Field>
              <Field label="Description" optional>
                <Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} />
              </Field>
              <Field label="Allowed website" optional hint="Browsers can only submit from this origin. Leave empty to accept any.">
                <Input type="url" value={allowedOrigin} onChange={(event) => setAllowedOrigin(event.target.value)} placeholder="https://example.com" />
              </Field>
              {error && <Callout tone="danger">{error}</Callout>}
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Creating your inbox…" : "Create form and open inbox"}
              </Button>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
