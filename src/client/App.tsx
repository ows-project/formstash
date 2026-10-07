import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api, ApiError, UNAUTHORIZED_EVENT } from "./api";
import type { UserInfo } from "./auth";
import { DashboardLayout } from "./components/DashboardLayout";
import { FormsProvider } from "./components/FormsProvider";
import { LoadingScreen } from "./components/LoadingScreen";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { LoginScreen } from "./screens/auth/LoginScreen";
import { ResetPasswordScreen } from "./screens/auth/ResetPasswordScreen";
import { SetupScreen } from "./screens/auth/SetupScreen";

type Screen = "loading" | "setup" | "login" | "reset" | "dashboard";

// Setup, sign-in, and reset render at whatever URL was opened, so a saved
// link still lands on the right page after signing in.
export function App() {
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get("reset") ?? "");
  const [screen, setScreen] = useState<Screen>(resetToken ? "reset" : "loading");
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loginNotice, setLoginNotice] = useState("");
  const [, navigate] = useLocation();
  const screenRef = useRef(screen);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if (resetToken) return;
    let cancelled = false;
    async function bootstrap() {
      try {
        const setup = await api<{ initialized: boolean }>("/api/setup/status");
        if (cancelled) return;
        if (!setup.initialized) return setScreen("setup");
        const result = await api<{ user: UserInfo }>("/api/auth/me");
        if (cancelled) return;
        setUser(result.user);
        setScreen("dashboard");
      } catch (error) {
        if (cancelled) return;
        if (!(error instanceof ApiError && error.status === 401)) setLoginNotice("Formstash couldn't check your session. Sign in to continue.");
        setScreen("login");
      }
    }
    void bootstrap();
    return () => { cancelled = true; };
  }, [resetToken]);

  useEffect(() => {
    function sessionEnded() {
      if (screenRef.current !== "dashboard") return;
      setUser(null);
      setLoginNotice("Your session ended. Sign in again to continue.");
      setScreen("login");
    }
    window.addEventListener(UNAUTHORIZED_EVENT, sessionEnded);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, sessionEnded);
  }, []);

  function signedIn(owner: UserInfo) {
    setUser(owner);
    setLoginNotice("");
    setScreen("dashboard");
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setScreen("login");
    navigate("/", { replace: true });
  }

  let content;
  if (screen === "loading") content = <LoadingScreen />;
  else if (screen === "setup") {
    content = <SetupScreen onComplete={(owner, formId) => { signedIn(owner); navigate(`/forms/${formId}`, { replace: true }); }} />;
  } else if (screen === "reset") {
    content = (
      <ResetPasswordScreen
        token={resetToken}
        onComplete={() => {
          navigate("/", { replace: true });
          setLoginNotice("Password updated. Sign in with your new password.");
          setScreen("login");
        }}
      />
    );
  } else if (screen === "dashboard" && user) {
    content = (
      <TooltipProvider delayDuration={300}>
        <FormsProvider>
          <DashboardLayout user={user} onSignOut={signOut} />
        </FormsProvider>
      </TooltipProvider>
    );
  } else content = <LoginScreen onLogin={signedIn} notice={loginNotice} />;

  return (
    <>
      {content}
      <Toaster />
    </>
  );
}
