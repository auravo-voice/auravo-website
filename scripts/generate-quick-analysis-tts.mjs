#!/usr/bin/env node
/**
 * One-time (or on copy change): render Quick Analysis coach lines with Deepgram Aura
 * and save MP3s under public/quick-analysis/tts/.
 *
 * Usage: npm run generate:qa-tts
 * Requires DEEPGRAM_API_KEY in .env or the environment.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "quick-analysis", "tts");

/** Keep in sync with app/quick-analysis/tts-prompts.ts (import-free for plain Node). */
const PROMPTS = [
  {
    id: "welcome",
    text: [
      "You're about to answer a few short questions to help us understand your communication skills.",
      "There are no right or wrong answers — just speak naturally.",
    ].join(" "),
  },
  {
    id: "q1_city",
    text: "Let's start with something simple. Tell me your name and a little about yourself.",
  },
  {
    id: "q2_duration",
    text: "Tell me a little about your typical day. What do you usually do from morning to evening?",
  },
  {
    id: "q3_about_city",
    text: "Tell me about a hobby, activity, or interest that you enjoy.",
  },
  {
    id: "midpoint",
    text: "Great job! We've already gathered enough information for a basic snapshot. Would you like to spend a couple more minutes for a more complete analysis?",
  },
  {
    id: "q4_objects",
    text: "If a friend were visiting your city for the first time, what would you recommend they see or do, and why?",
  },
  {
    id: "q5_visual",
    text: "Please describe everything you notice in this image. What is happening? What might happen next?",
  },
  {
    id: "results",
    text: "Here's your full English profile snapshot. You're doing well in some areas, and there's exciting room to grow in others. Head to your dashboard anytime to keep practicing with Auravo.",
  },
  {
    id: "thank_you_no",
    text: "Thank you so much for your time! Your basic snapshot is saved — visit your dashboard to keep practicing with Auravo.",
  },
  {
    id: "thank_you_submit",
    text: "Thank you! Your snapshot is saved — keep practicing from your Auravo dashboard.",
  },
  {
    id: "thank_you_page",
    text: "Thank you for completing Quick Analysis. Your snapshot is ready — visit your dashboard to keep building with daily practice and coaching.",
  },
];

const DEEPGRAM_MODEL = "aura-2-thalia-en";
const FORCE = process.argv.includes("--force");

function loadEnvFile() {
  if (process.env.DEEPGRAM_API_KEY?.trim()) return;
  for (const name of [".env.local", ".env"]) {
    const envPath = path.join(ROOT, name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] != null) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
    if (process.env.DEEPGRAM_API_KEY?.trim()) return;
  }
}

async function synthesize(apiKey, text) {
  const res = await fetch(
    `https://api.deepgram.com/v1/speak?model=${DEEPGRAM_MODEL}&encoding=mp3`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Deepgram ${res.status}: ${err.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  loadEnvFile();
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    console.error("Set DEEPGRAM_API_KEY in .env.local or .env (or export it) before running this script.");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  let created = 0;
  let skipped = 0;

  for (const { id, text } of PROMPTS) {
    const outPath = path.join(OUT_DIR, `${id}.mp3`);
    if (!FORCE && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      console.log(`skip ${id}.mp3 (exists — pass --force to regenerate)`);
      skipped += 1;
      continue;
    }

    process.stdout.write(`generating ${id}.mp3 … `);
    const audio = await synthesize(apiKey, text);
    fs.writeFileSync(outPath, audio);
    console.log(`ok (${(audio.length / 1024).toFixed(1)} KB)`);
    created += 1;
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped → ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
