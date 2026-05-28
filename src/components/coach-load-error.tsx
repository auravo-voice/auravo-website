export function CoachLoadError({ title = "Coach unavailable", message }: { title?: string; message: string }) {
  return (
    <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm">
      <p className="font-semibold text-destructive">{title}</p>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Ensure Ollama is running locally and the model is installed:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-foreground">ollama pull qwen2.5:3b</code>
      </p>
    </div>
  );
}
