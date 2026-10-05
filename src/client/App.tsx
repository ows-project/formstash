import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowLeft,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  Copy,
  Download,
  FileText,
  FormInput,
  LogOut,
  Mail,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { FormSummary, Submission, SubmissionStatus } from "../shared/types";
import { api, ApiError } from "./api";
import { ActivityPage, FormSettingsModal, SettingsPage } from "./ManagementPages";

type Screen = "loading" | "setup" | "login" | "reset" | "dashboard";
type Filter = "all" | SubmissionStatus;
type DashboardPage = "forms" | "activity" | "settings";

interface UserInfo {
  id: string;
  email: string;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function formatTime(value: string): string {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function initials(submission: Submission): string {
  const name = displayValue(submission.payload.name);
  if (name !== "—") return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return displayValue(submission.payload.email).slice(0, 2).toUpperCase();
}

function sourceLabel(submission: Submission): string {
  if (!submission.sourceUrl) return "Direct";
  try {
    return new URL(submission.sourceUrl).pathname || "/";
  } catch {
    return submission.sourceUrl;
  }
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><img src="/formstash-icon.svg" alt="" /></span>
      <strong>Formstash</strong>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="center-screen">
      <div className="loading-mark"><img src="/formstash-icon.svg" alt="" /></div>
      <p>Opening Formstash…</p>
    </main>
  );
}

function SetupScreen({ onComplete }: { onComplete: (user: UserInfo) => void }) {
  const [step, setStep] = useState(1);
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
      const result = await api<{ user: UserInfo }>("/api/setup", {
        method: "POST",
        body: JSON.stringify({ email, password, formName, description, allowedOrigin }),
      });
      onComplete(result.user);
    } catch (caught) {
      setError(message(caught));
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow"><Sparkles size={14} /> First-run setup</span>
          <h1>Your form endpoint,<br />ready in minutes.</h1>
          <p>Collect submissions without operating another server. Your data stays in your Cloudflare account.</p>
        </div>
        <div className="setup-benefits">
          <span><ShieldCheck size={17} /> Single-tenant by default</span>
          <span><Code2 size={17} /> Built for headless forms</span>
          <span><Braces size={17} /> Flexible submission fields</span>
        </div>
      </section>
      <section className="auth-main">
        <div className="setup-card">
          <div className="step-indicator" aria-label={`Step ${step} of 2`}>
            <span className="active" />
            <span className={step === 2 ? "active" : ""} />
          </div>
          {step === 1 ? (
            <form onSubmit={continueSetup}>
              <div className="form-heading">
                <span className="step-label">Step 1 of 2</span>
                <h2>Create your owner account</h2>
                <p>This account controls this Formstash instance.</p>
              </div>
              <label>Email address<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" minLength={12} required /></label>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button wide" type="submit">Continue <span>→</span></button>
            </form>
          ) : (
            <form onSubmit={finishSetup}>
              <button className="back-button" type="button" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button>
              <div className="form-heading">
                <span className="step-label">Step 2 of 2</span>
                <h2>Create your first form</h2>
                <p>You can change these details later.</p>
              </div>
              <label>Form name<input autoFocus value={formName} onChange={(event) => setFormName(event.target.value)} maxLength={80} required /></label>
              <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} /></label>
              <label>Allowed website <span className="optional">Optional</span><input type="url" value={allowedOrigin} onChange={(event) => setAllowedOrigin(event.target.value)} placeholder="https://example.com" /><small>Browser submissions will only be accepted from this origin.</small></label>
              {error && <p className="form-error">{error}</p>}
              <button className="primary-button wide" type="submit" disabled={submitting}>{submitting ? "Creating instance…" : "Create Formstash instance"}</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: UserInfo) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await api<{ user: UserInfo }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(result.user);
    } catch (caught) {
      setError(message(caught));
      setSubmitting(false);
    }
  }

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/api/auth/password/request", { method: "POST", body: JSON.stringify({ email }) });
      setRequested(true);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <div className="login-brand"><Brand /></div>
      {forgot ? (
        <form className="login-card" onSubmit={requestReset}>
          <button className="back-button" type="button" onClick={() => { setForgot(false); setRequested(false); setError(""); }}><ArrowLeft size={15} /> Back to sign in</button>
          <div className="form-heading"><h1>Reset your password</h1><p>{requested ? "If that account exists, a reset link has been queued." : "We’ll send a one-hour reset link through your configured SMTP server."}</p></div>
          {!requested && <><label>Email address<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button wide" disabled={submitting}>{submitting ? "Requesting…" : "Send reset link"}</button></>}
          {requested && <div className="success-banner"><CheckCircle2 size={18} />Request received</div>}
        </form>
      ) : (
        <form className="login-card" onSubmit={submit}>
          <div className="form-heading"><h1>Welcome back</h1><p>Sign in to manage your forms and submissions.</p></div>
          <label>Email address<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="text-button forgot-button" type="button" onClick={() => setForgot(true)}>Forgot password?</button>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button wide" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
        </form>
      )}
    </main>
  );
}

function ResetPasswordScreen({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) return setError("Passwords do not match");
    setSubmitting(true);
    setError("");
    try {
      await api("/api/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      onComplete();
    } catch (caught) {
      setError(message(caught));
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen"><div className="login-brand"><Brand /></div><form className="login-card" onSubmit={submit}>
      <div className="form-heading"><h1>Choose a new password</h1><p>Use at least 12 characters.</p></div>
      <label>New password<input autoFocus type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <label>Confirm password<input type="password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button wide" disabled={submitting}>{submitting ? "Resetting…" : "Reset password"}</button>
    </form></main>
  );
}

function DetailPanel({ submission, onClose, onStatus, onDelete }: {
  submission: Submission;
  onClose: () => void;
  onStatus: (status: SubmissionStatus) => void;
  onDelete: () => void;
}) {
  const email = displayValue(submission.payload.email);
  const name = displayValue(submission.payload.name);
  return (
    <aside className="detail-panel">
      <div className="detail-topbar">
        <span className={`status-pill ${submission.status}`}>{submission.status}</span>
        <button className="icon-button" onClick={onClose} aria-label="Close submission"><X size={18} /></button>
      </div>
      <div className="detail-person">
        <span className="large-avatar">{initials(submission)}</span>
        <div><h2>{name === "—" ? email : name}</h2>{name !== "—" && <p>{email}</p>}</div>
      </div>
      <dl className="field-list">
        {Object.entries(submission.payload).map(([key, value]) => (
          <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{displayValue(value)}</dd></div>
        ))}
        <div><dt>Source</dt><dd>{submission.sourceUrl ? <a href={submission.sourceUrl} target="_blank" rel="noreferrer">{submission.sourceUrl}</a> : "Direct"}</dd></div>
        <div><dt>Received</dt><dd>{new Date(submission.receivedAt).toLocaleString()}</dd></div>
      </dl>
      <details className="raw-payload">
        <summary><Braces size={16} /> Raw payload <ChevronDown size={16} /></summary>
        <pre>{JSON.stringify(submission.payload, null, 2)}</pre>
      </details>
      <div className="detail-actions">
        <button className="secondary-button" onClick={() => onStatus(submission.status === "unread" ? "read" : "unread")}>
          {submission.status === "unread" ? <Check size={16} /> : <Circle size={16} />} {submission.status === "unread" ? "Mark read" : "Mark unread"}
        </button>
        <button className="danger-button" onClick={onDelete}><Trash2 size={16} /> Delete</button>
      </div>
    </aside>
  );
}

function Dashboard({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const [page, setPage] = useState<DashboardPage>("forms");
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [formQuery, setFormQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showFormSettings, setShowFormSettings] = useState(false);

  const selectedForm = forms.find((form) => form.id === selectedFormId) ?? forms[0];
  const selectedSubmission = submissions.find((submission) => submission.id === selectedId) ?? null;
  const visibleForms = forms.filter((form) => form.name.toLowerCase().includes(formQuery.toLowerCase()));

  async function loadForms(preferredId?: string) {
    const result = await api<{ forms: FormSummary[] }>("/api/forms");
    setForms(result.forms);
    setSelectedFormId((current) => preferredId ?? current ?? result.forms[0]?.id ?? null);
  }

  async function loadSubmissions(formId: string, activeFilter = filter, search = query) {
    const parameters = new URLSearchParams();
    if (activeFilter !== "all") parameters.set("status", activeFilter);
    if (search.trim()) parameters.set("q", search.trim());
    const result = await api<{ submissions: Submission[] }>(`/api/forms/${formId}/submissions?${parameters}`);
    setSubmissions(result.submissions);
    setSelectedId((current) => result.submissions.some((entry) => entry.id === current) ? current : null);
  }

  useEffect(() => {
    loadForms().catch((error) => setNotice(message(error))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFormId) return;
    const timer = window.setTimeout(() => {
      loadSubmissions(selectedFormId).catch((error) => setNotice(message(error)));
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [selectedFormId, filter, query]);

  async function selectSubmission(submission: Submission) {
    setSelectedId(submission.id);
    if (submission.status === "unread") await updateStatus(submission, "read");
  }

  async function updateStatus(submission: Submission, status: SubmissionStatus) {
    if (!selectedForm) return;
    await api(`/api/forms/${selectedForm.id}/submissions/${submission.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setSubmissions((entries) => entries.map((entry) => entry.id === submission.id ? { ...entry, status } : entry));
    await loadForms(selectedForm.id);
  }

  async function deleteSubmission(submission: Submission) {
    if (!selectedForm || !window.confirm("Delete this submission permanently?")) return;
    await api(`/api/forms/${selectedForm.id}/submissions/${submission.id}`, { method: "DELETE" });
    setSubmissions((entries) => entries.filter((entry) => entry.id !== submission.id));
    setSelectedId(null);
    await loadForms(selectedForm.id);
  }

  async function copyEndpoint() {
    if (!selectedForm) return;
    await navigator.clipboard.writeText(`${window.location.origin}/f/${selectedForm.slug}`);
    setNotice("Endpoint copied");
    window.setTimeout(() => setNotice(""), 1800);
  }

  async function createForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const created = await api<{ id: string }>("/api/forms", { method: "POST", body: JSON.stringify({ name: data.get("name") }) });
      await loadForms(created.id);
      setShowNewForm(false);
    } catch (error) {
      setNotice(message(error));
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    onLogout();
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <header className="topbar">
        {page === "forms" && <button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open forms"><Menu size={20} /></button>}
        <Brand />
        <nav>
          <button className={page === "forms" ? "nav-active" : ""} onClick={() => setPage("forms")}><FormInput size={17} /> Forms</button>
          <button className={page === "activity" ? "nav-active" : ""} onClick={() => setPage("activity")}><Activity size={17} /> Activity</button>
          <button className={page === "settings" ? "nav-active" : ""} onClick={() => setPage("settings")}><Settings size={17} /> Settings</button>
        </nav>
        <div className="account-area">
          <details className="account-menu">
            <summary><span className="avatar">{user.email.slice(0, 2).toUpperCase()}</span><span>{user.email}</span><ChevronDown size={15} /></summary>
            <div><button onClick={logout}><LogOut size={15} /> Sign out</button></div>
          </details>
        </div>
      </header>

      {page === "forms" && <aside className={`forms-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-mobile-head"><strong>Forms</strong><button className="icon-button" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <label className="search-box"><Search size={16} /><input value={formQuery} onChange={(event) => setFormQuery(event.target.value)} placeholder="Search forms…" /></label>
        <div className="sidebar-section"><span className="sidebar-label">Active</span>
          {visibleForms.map((form) => (
            <button key={form.id} className={`form-link ${selectedForm?.id === form.id ? "active" : ""}`} onClick={() => { setSelectedFormId(form.id); setSelectedId(null); setSidebarOpen(false); }}>
              <FileText size={17} /><span>{form.name}</span>{form.unreadCount > 0 && <b title={`${form.unreadCount} unread submissions`}>{form.unreadCount} unread</b>}
            </button>
          ))}
          {!visibleForms.length && <p className="sidebar-empty">No forms found</p>}
        </div>
        <button className="new-form-button" onClick={() => setShowNewForm(true)}><Plus size={17} /> New form</button>
      </aside>}

      {page === "forms" && (selectedForm ? (
        <main className={`workspace ${selectedSubmission ? "with-detail" : ""}`}>
          <section className="inbox-pane">
            <header className="form-header">
              <div><div className="title-row"><h1>{selectedForm.name}</h1><span className="active-badge"><span /> Active</span></div><p>{selectedForm.description || "Collect submissions from your form."}</p></div>
              <div className="header-actions"><a className="secondary-button" href={`/api/forms/${selectedForm.id}/export.csv`}><Download size={16} /> Export</a><button className="secondary-button" onClick={copyEndpoint}><Code2 size={16} /> Copy endpoint</button><button className="secondary-button" onClick={() => setShowFormSettings(true)}><Settings size={16} /> Form settings</button></div>
            </header>
            <button className="endpoint" onClick={copyEndpoint} title="Copy endpoint">
              <span>POST</span><code className="endpoint-full">{window.location.origin}/f/{selectedForm.slug}</code><code className="endpoint-short">/f/{selectedForm.slug}</code><Copy size={16} />
            </button>
            <div className="inbox-tools">
              <label className="search-box submission-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search submissions…" /></label>
              <div className="filters">
                {(["unread", "all", "spam"] as Filter[]).map((value) => {
                  const count = value === "unread" ? selectedForm.unreadCount : value === "spam" ? selectedForm.spamCount : selectedForm.totalCount;
                  return <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)} <span>{count}</span></button>;
                })}
              </div>
            </div>
            <div className="submission-columns"><span>Contact</span><span>Name</span><span>Company</span><span>Source</span><span>Received</span></div>
            <div className="submission-list">
              {submissions.map((submission) => (
                <button key={submission.id} className={`submission-row ${selectedId === submission.id ? "selected" : ""}`} onClick={() => selectSubmission(submission)}>
                  <span className="contact-cell">{submission.status === "unread" && <i />}<span className="row-avatar">{initials(submission)}</span><strong>{displayValue(submission.payload.email)}</strong></span>
                  <span>{displayValue(submission.payload.name)}</span>
                  <span>{displayValue(submission.payload.company)}</span>
                  <span>{sourceLabel(submission)}</span>
                  <time dateTime={submission.receivedAt}>{formatTime(submission.receivedAt)}</time>
                </button>
              ))}
              {!submissions.length && (
                <div className="empty-state"><span><Mail size={23} /></span><h2>No submissions here</h2><p>{query || filter !== "all" ? "Try changing your search or filter." : "Send a POST request to the endpoint above to see your first submission."}</p></div>
              )}
            </div>
          </section>
          {selectedSubmission && <DetailPanel submission={selectedSubmission} onClose={() => setSelectedId(null)} onStatus={(status) => updateStatus(selectedSubmission, status)} onDelete={() => deleteSubmission(selectedSubmission)} />}
        </main>
      ) : (
        <main className="no-form"><FileText size={26} /><h1>Create your first form</h1><button className="primary-button" onClick={() => setShowNewForm(true)}>New form</button></main>
      ))}
      {page === "activity" && <ActivityPage />}
      {page === "settings" && <SettingsPage />}

      {showNewForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowNewForm(false)}>
          <form className="modal" onSubmit={createForm} onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head"><div><h2>New form</h2><p>Create another collection endpoint.</p></div><button className="icon-button" type="button" onClick={() => setShowNewForm(false)}><X size={18} /></button></div>
            <label>Form name<input name="name" autoFocus placeholder="Contact form" maxLength={80} required /></label>
            <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setShowNewForm(false)}>Cancel</button><button className="primary-button">Create form</button></div>
          </form>
        </div>
      )}
      {showFormSettings && selectedForm && <FormSettingsModal form={selectedForm} onClose={() => setShowFormSettings(false)} onSaved={() => { setShowFormSettings(false); loadForms(selectedForm.id).catch((error) => setNotice(message(error))); }} />}
      {notice && <div className="toast"><CheckCircle2 size={16} /> {notice}</div>}
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") ?? "");

  useEffect(() => {
    async function bootstrap() {
      if (resetToken) return setScreen("reset");
      try {
        const setup = await api<{ initialized: boolean }>("/api/setup/status");
        if (!setup.initialized) return setScreen("setup");
        try {
          const result = await api<{ user: UserInfo }>("/api/auth/me");
          setUser(result.user);
          setScreen("dashboard");
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) setScreen("login");
          else throw error;
        }
      } catch {
        setScreen("login");
      }
    }
    bootstrap();
  }, [resetToken]);

  if (screen === "loading") return <LoadingScreen />;
  if (screen === "setup") return <SetupScreen onComplete={(owner) => { setUser(owner); setScreen("dashboard"); }} />;
  if (screen === "login") return <LoginScreen onLogin={(owner) => { setUser(owner); setScreen("dashboard"); }} />;
  if (screen === "reset") return <ResetPasswordScreen token={resetToken} onComplete={() => { window.history.replaceState({}, "", "/"); setScreen("login"); }} />;
  return user ? <Dashboard user={user} onLogout={() => { setUser(null); setScreen("login"); }} /> : <LoginScreen onLogin={(owner) => { setUser(owner); setScreen("dashboard"); }} />;
}
