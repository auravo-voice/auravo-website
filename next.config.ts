import type { NextConfig } from "next";

/**
 * Hostnames allowed to load Next dev assets (HMR, `/_next/*`) from a non-localhost origin.
 * Set `NEXT_ALLOWED_DEV_ORIGINS` (comma-separated) when you open the dev app from another device
 * (e.g. http://192.168.x.x:3000). Values may be bare hosts, host:port, or full URLs.
 */
function parseAllowedDevOriginHosts(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    try {
      if (entry.includes("://")) {
        out.add(new URL(entry).hostname.toLowerCase());
        continue;
      }
    } catch {
      /* fall through */
    }
    out.add(entry.split(":")[0]!.trim().toLowerCase());
  }
  return [...out];
}

const allowedDevOrigins = parseAllowedDevOriginHosts(process.env.NEXT_ALLOWED_DEV_ORIGINS);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
