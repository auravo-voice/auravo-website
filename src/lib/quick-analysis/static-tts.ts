import fs from "node:fs";
import path from "node:path";

import { QUICK_ANALYSIS_TTS_PROMPTS } from "@/app/quick-analysis/tts-prompts";

const TTS_DIR = path.join(process.cwd(), "public", "quick-analysis", "tts");

const TEXT_TO_FILE = new Map(
  QUICK_ANALYSIS_TTS_PROMPTS.map((p) => [p.text.trim(), path.join(TTS_DIR, `${p.id}.mp3`)]),
);

/** Read a pre-generated MP3 for fixed coach copy, if present on disk. */
export function readStaticQuickAnalysisTts(text: string): Buffer | null {
  const filePath = TEXT_TO_FILE.get(text.trim());
  if (!filePath || !fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size < 1) return null;
  return fs.readFileSync(filePath);
}
