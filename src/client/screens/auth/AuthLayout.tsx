import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Brand } from "../../components/Brand";

// Gradient canvas shared by setup, sign-in, and password reset.
export function AuthLayout({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <main className={cn("relative min-h-dvh overflow-hidden bg-auth text-white", aside && "lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]")}>
      {aside && <section className="relative hidden min-h-dvh flex-col px-[clamp(40px,5vw,88px)] py-12 lg:flex">{aside}</section>}
      <section className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10 sm:px-8">
        <Brand tone="light" className={cn(aside && "lg:hidden")} />
        {children}
      </section>
    </main>
  );
}

export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-[440px] rounded-3xl border border-white/60 bg-surface/95 p-7 text-ink shadow-[0_30px_80px_-30px_rgb(3_11_34/0.75)] backdrop-blur-xl sm:p-9 dark:border-line", className)}>
      {children}
    </div>
  );
}

export function AuthHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="m-0 text-[26px] leading-tight font-extrabold tracking-[-0.03em] text-ink">{title}</h1>
      {children && <p className="m-0 mt-2 text-sm leading-relaxed text-muted">{children}</p>}
    </div>
  );
}
