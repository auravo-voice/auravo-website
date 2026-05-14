// Empty stub so libs that `import "server-only"` (e.g. heuristics, transcription types) can be
// imported from vitest tests without throwing the "this module cannot be imported in a Client
// Component" error. The stub is wired in via `vitest.config.ts`.
export {};
