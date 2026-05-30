import "server-only";

/** Shared cookie domain for *.auravo.ai in production (auth survives www vs apex). */
export function getAuravoCookieDomain(): string | undefined {
  const override = process.env.AURAVO_COOKIE_DOMAIN?.trim();
  if (override) return override;
  if (process.env.NODE_ENV !== "production") return undefined;
  return ".auravo.ai";
}
