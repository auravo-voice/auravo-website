export function CoachLoadError({ title = "Coach unavailable", message }: { title?: string; message: string }) {
  return (
    <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm">
      <p className="font-semibold text-destructive">{title}</p>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Check that{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-foreground">GROQ_API_KEY</code> is set on the
        server and Groq is reachable.
      </p>
    </div>
  );
}
