export function LoadingScreen({ label = "Opening Formstash…" }: { label?: string }) {
  return (
    <main className="grid min-h-dvh place-content-center justify-items-center gap-4 bg-canvas text-muted" aria-busy="true">
      <img src="/formstash-icon.svg" alt="" className="size-14 animate-pulse" />
      <p className="m-0 text-sm font-medium">{label}</p>
    </main>
  );
}
