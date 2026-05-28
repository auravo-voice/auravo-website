import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import type PocketBase from "pocketbase";
import { getDataDir } from "@/db/client";
import { getTempAudioRoot } from "@/lib/storage/temp-audio";
import { getPocketBaseUrl } from "@/lib/pocketbase";
import { PB } from "@/db/collections";
import { isPocketBaseStorage } from "@/lib/storage/env";
import type { DraftSegmentRow } from "@/db/queries/baseline-segments";

/** Temp path used when uploading assessment draft segments (`writeTempAudioFile`). */
export function draftSegmentTempRef(userId: string, segmentKind: string, ext: "webm" | "m4a" = "webm"): string {
  return `tmp/${userId}.${segmentKind}.${ext}`;
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

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
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

/**
 * Resolve stored audio reference to a local absolute path for analysis.
 * SQLite: `tmp/...` and `data/uploads/...`. PocketBase: HTTP file URLs and downloads.
 */
export async function resolveAudioAbsolutePath(
  audioRef: string,
  pb?: PocketBase,
): Promise<string> {
  const ref = audioRef.trim();
  if (!ref) {
    throw new Error("Audio reference is empty.");
  }

  if (path.isAbsolute(ref) && (await exists(ref))) return ref;

  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    return downloadUrlToTemp(ref);
  }

  if (!isPocketBaseStorage()) {
    const dataDir = getDataDir();
    if (ref.startsWith("uploads/")) {
      const absolute = path.join(dataDir, ref);
      if (await exists(absolute)) return absolute;
      throw new Error(`Audio file not found: ${ref}`);
    }
  }

  const tmpRoot = getTempAudioRoot();
  if (ref.startsWith("tmp/")) {
    const absolute = path.join(tmpRoot, path.basename(ref));
    if (await exists(absolute)) return absolute;
    throw new Error(`Audio file not found: ${ref}`);
  }

  if (!isPocketBaseStorage() && ref.startsWith("uploads/")) {
    const absolute = path.join(tmpRoot, path.basename(ref));
    if (await exists(absolute)) return absolute;
  }

  const joined = path.join(tmpRoot, ref);
  if (await exists(joined)) return joined;

  if (pb && !ref.includes("/")) {
    const url = pb.files.getURL(
      { collectionId: PB.practiceSessions, id: ref.split(":")[0] ?? "" },
      ref,
    );
    return downloadUrlToTemp(url);
  }

  throw new Error(`Audio file not found: ${ref}`);
}

/** Load draft segment audio (SQLite paths or PocketBase file URL on segment row). */
export async function resolveDraftSegmentAudio(
  _userId: string,
  segment: DraftSegmentRow,
  pb?: PocketBase,
): Promise<string> {
  return resolveAudioAbsolutePath(segment.audioRelativePath, pb);
}
