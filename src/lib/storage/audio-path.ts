import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import type PocketBase from "pocketbase";
import { getTempAudioRoot } from "@/lib/storage/temp-audio";
import { getPocketBaseUrl } from "@/lib/pocketbase";
import { PB } from "@/db/collections";

/**
 * Resolve stored audio reference to a local absolute path for analysis.
 * Supports temp paths (`tmp/...`), legacy `uploads/...` under tmp, and PocketBase file URLs.
 */
export async function resolveAudioAbsolutePath(
  audioRef: string,
  pb?: PocketBase,
): Promise<string> {
  if (path.isAbsolute(audioRef) && (await exists(audioRef))) return audioRef;

  const root = getTempAudioRoot();
  if (audioRef.startsWith("tmp/")) {
    return path.join(root, path.basename(audioRef));
  }
  if (audioRef.startsWith("uploads/")) {
    return path.join(root, path.basename(audioRef));
  }

  if (audioRef.startsWith("http://") || audioRef.startsWith("https://")) {
    return downloadUrlToTemp(audioRef);
  }

  if (pb && !audioRef.includes("/")) {
    const url = pb.files.getURL({ collectionId: PB.practiceSessions, id: audioRef.split(":")[0] ?? "" }, audioRef);
    return downloadUrlToTemp(url);
  }

  const joined = path.join(root, audioRef);
  if (await exists(joined)) return joined;
  throw new Error(`Audio file not found: ${audioRef}`);
}

export function pocketBaseFileUrl(
  collection: string,
  recordId: string,
  filename: string,
  token?: string,
): string {
  const base = getPocketBaseUrl();
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${base}/api/files/${collection}/${recordId}/${filename}${q}`;
}

async function downloadUrlToTemp(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download audio (${res.status})`);
  const root = getTempAudioRoot();
  await fs.mkdir(root, { recursive: true });
  const name = `dl-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
  const absolutePath = path.join(root, name);
  await fs.writeFile(absolutePath, Buffer.from(await res.arrayBuffer()));
  return absolutePath;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Join multiple audio refs into absolute paths (meeting/simulation finalize). */
export async function resolveAudioAbsolutePaths(refs: string[], pb?: PocketBase): Promise<string[]> {
  return Promise.all(refs.map((r) => resolveAudioAbsolutePath(r, pb)));
}
