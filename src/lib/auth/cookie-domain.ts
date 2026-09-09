import "server-only";

/** Shared cookie domain for *.auravo.ai in production (auth survives www vs apex). */
export function getAuravoCookieDomain(): string | undefined {
  const override = process.env.AURAVO_COOKIE_DOMAIN?.trim();
  if (override === "host" || override === "none") return undefined;
  if (override) return override;
  if (process.env.NODE_ENV !== "production") return undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl?.includes("talkinglabs.in")) return undefined;
  return ".auravo.ai";
}
