import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Python used to run `transcribe_faster_whisper.py`, `extract_opensmile.py`, and `extract_vad.py`.
 *
 * Resolution order:
 * 1. `FASTER_WHISPER_PYTHON` — always honored (set to your venv interpreter path)
 * 2. `PYTHON` — only if it looks like an explicit interpreter path (absolute or contains a path separator).
 *    A bare value like `python3` is **ignored** so we can prefer `.venv-transcription` (many shells export
 *    `PYTHON=python3`, which points at system Python without faster-whisper).
 * 3. `.venv-transcription` under cwd, `INIT_CWD`, `AURAVO_PROJECT_ROOT`, or ancestors of cwd
 * 4. Fallback `python3` / `python` on PATH
 */
export function resolveTranscriptionPython(): string {
  const fw = (process.env.FASTER_WHISPER_PYTHON ?? "").trim();
  if (fw) return fw;

  const pyEnv = (process.env.PYTHON ?? "").trim();
  if (pyEnv && looksLikeExplicitPythonPath(pyEnv)) return pyEnv;

  const venvBin =
    process.platform === "win32"
      ? path.join(".venv-transcription", "Scripts", "python.exe")
      : path.join(".venv-transcription", "bin", "python");

  for (const root of collectProjectRootCandidates()) {
    const py = path.join(root, venvBin);
    if (existsSync(py)) return py;
  }

  return process.platform === "win32" ? "python" : "python3";
}

function looksLikeExplicitPythonPath(s: string): boolean {
  if (path.isAbsolute(s)) return true;
  if (s.includes("/") || s.includes("\\")) return true;
  return false;
}

function collectProjectRootCandidates(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (p: string | undefined) => {
    if (!p?.trim()) return;
    const abs = path.resolve(p.trim());
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };

  add(process.cwd());
  add(process.env.INIT_CWD);
  add(process.env.AURAVO_PROJECT_ROOT);

  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 14; i++) {
    add(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return out;
}
