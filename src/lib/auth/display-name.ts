const NUMERIC_ONLY = /^\d+$/;

/** True when the value is non-empty and contains only digits (e.g. a Google OAuth subject id). */
export function isNumericOnlyDisplayName(value: string | null | undefined): boolean {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 && NUMERIC_ONLY.test(trimmed);
}

export function emailLocalPart(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return null;
  const local = trimmed.slice(0, at).trim();
  return local || null;
}

export type ResolveDisplayNameInput = {
  /** Candidate from OAuth profile, signup form, or existing record field. */
  profileName?: string | null;
  email?: string | null;
  fallback?: string;
};

/**
 * Pick a safe display name for persistence. Rejects numeric-only profile names
 * (mis-mapped OAuth ids) and falls back to email local-part, then "Learner".
 */
export function resolveDisplayName(input: ResolveDisplayNameInput): string {
  const fallback = input.fallback?.trim() || "Learner";
  const profile = typeof input.profileName === "string" ? input.profileName.trim() : "";
  if (profile && !isNumericOnlyDisplayName(profile)) {
    return profile;
  }
  return emailLocalPart(input.email) ?? fallback;
}

export type DisplayNameFields = {
  name?: string | null;
  display_name?: string | null;
};

/** True when either `name` or `display_name` is entirely numeric. */
export function needsDisplayNameRepair(fields: DisplayNameFields): boolean {
  return (
    isNumericOnlyDisplayName(fields.name) || isNumericOnlyDisplayName(fields.display_name)
  );
}

export type RepairDisplayNameInput = DisplayNameFields & {
  email?: string | null;
  /** Google OAuth profile name when available (OAuth login / callback). */
  googleProfileName?: string | null;
};

/**
 * Returns a repaired display name when either field is numeric-only; otherwise null.
 * Prefers an existing valid non-numeric field, then Google profile name, email prefix, "Learner".
 */
export function repairDisplayNameIfNeeded(input: RepairDisplayNameInput): string | null {
  if (!needsDisplayNameRepair(input)) return null;

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const displayName =
    typeof input.display_name === "string" ? input.display_name.trim() : "";

  if (name && !isNumericOnlyDisplayName(name)) return name;
  if (displayName && !isNumericOnlyDisplayName(displayName)) return displayName;

  return resolveDisplayName({
    profileName: input.googleProfileName,
    email: input.email,
  });
}

/** True when a stored name is empty, numeric-only, or exactly the email local-part. */
export function storedDisplayNameIsReplaceable(
  value: string | null | undefined,
  email: string | null | undefined,
): boolean {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return true;
  if (isNumericOnlyDisplayName(trimmed)) return true;
  const prefix = emailLocalPart(email);
  return prefix !== null && trimmed === prefix;
}

/** True when both stored fields may be upgraded (no protected custom/human name). */
export function storedDisplayNamesCanUpgrade(
  fields: DisplayNameFields & { email?: string | null },
): boolean {
  return (
    storedDisplayNameIsReplaceable(fields.name, fields.email) &&
    storedDisplayNameIsReplaceable(fields.display_name, fields.email)
  );
}

/** Read Google profile name from PocketBase OAuth `meta` (not from the user record). */
export function extractGoogleProfileName(
  meta?: { [key: string]: unknown } | null,
): string | null {
  if (!meta || typeof meta !== "object") return null;

  const primary = typeof meta.name === "string" ? meta.name.trim() : "";
  if (primary && !isNumericOnlyDisplayName(primary)) return primary;

  const rawUser = meta.rawUser;
  if (rawUser && typeof rawUser === "object" && rawUser !== null) {
    const fromRaw = (rawUser as Record<string, unknown>).name;
    const rawName = typeof fromRaw === "string" ? fromRaw.trim() : "";
    if (rawName && !isNumericOnlyDisplayName(rawName)) return rawName;
  }

  return null;
}

/**
 * OAuth callback: upgrade replaceable names from Google profile, else numeric-only repair.
 * Returns null when no PocketBase update is needed.
 *
 * `googleProfileName` must come from `extractGoogleProfileName(authData.meta)`.
 */
export function resolveOAuthDisplayNameUpdate(input: RepairDisplayNameInput): string | null {
  const googleRaw =
    typeof input.googleProfileName === "string" ? input.googleProfileName.trim() : "";
  const validGoogle =
    googleRaw && !isNumericOnlyDisplayName(googleRaw) ? googleRaw : null;

  if (validGoogle && storedDisplayNamesCanUpgrade(input)) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    const displayName =
      typeof input.display_name === "string" ? input.display_name.trim() : "";
    if (name === validGoogle && displayName === validGoogle) return null;
    return validGoogle;
  }

  return repairDisplayNameIfNeeded(input);
}

/** Read-path display name: skip numeric-only values and prefer valid fields. */
export function readDisplayName(
  fields: DisplayNameFields & { email?: string | null },
  fallback = "Learner",
): string {
  const displayName =
    typeof fields.display_name === "string" ? fields.display_name.trim() : "";
  if (displayName && !isNumericOnlyDisplayName(displayName)) return displayName;

  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  if (name && !isNumericOnlyDisplayName(name)) return name;

  return resolveDisplayName({ email: fields.email, fallback });
}
