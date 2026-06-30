import { ClientResponseError } from "pocketbase";

/** PocketBase returns 404 "Missing collection context." when the collection was never created in admin. */
export function isMissingPocketBaseCollection(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return false;
  if (error.status !== 404) return false;
  const msg = error.response?.message ?? error.message ?? "";
  return msg.toLowerCase().includes("missing collection context");
}

export const POCKETBASE_WEB_COLLECTIONS_HINT =
  "Create the web data collections in PocketBase admin — see docs/POCKETBASE.md (baseline_segments, practice_sessions, etc.).";

type PocketBaseFieldError = {
  code?: string;
  message?: string;
};

function friendlyFieldMessage(field: string, detail: PocketBaseFieldError): string | null {
  const code = detail.code?.trim();
  const message = detail.message?.trim();

  if (field === "email") {
    if (code === "validation_not_unique") {
      return "This email is already registered — try signing in instead.";
    }
    if (code === "validation_is_email") {
      return "Enter a valid email address.";
    }
  }

  if (field === "password") {
    if (code === "validation_min_text_constraint") {
      return "Password must be at least 8 characters.";
    }
  }

  if (field === "passwordConfirm") {
    if (code === "validation_values_mismatch") {
      return "Passwords don't match.";
    }
  }

  if (message) {
    if (field === "email" || field === "password" || field === "passwordConfirm") {
      return message;
    }
    return `${field}: ${message}`;
  }

  return null;
}

function loginFailureMessage(error: ClientResponseError): string {
  const top = (error.response?.message ?? error.message ?? "").toLowerCase();
  if (top.includes("failed to authenticate") || top.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (top.includes("email not verified") || top.includes("not verified")) {
    return "Verify your email before signing in — check your inbox for the confirmation link.";
  }
  return pocketBaseErrorMessage(error);
}

/** Human-readable message from PocketBase validation (400) or other API errors. */
export function pocketBaseErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : "Request failed.";
  }

  const data = error.response?.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object") {
    const parts: string[] = [];
    for (const [field, detail] of Object.entries(data)) {
      if (detail && typeof detail === "object") {
        const friendly = friendlyFieldMessage(field, detail as PocketBaseFieldError);
        if (friendly) parts.push(friendly);
      } else if (typeof detail === "string" && detail.trim()) {
        parts.push(`${field}: ${detail.trim()}`);
      }
    }
    if (parts.length > 0) return parts.join(" ");
  }

  return error.response?.message ?? error.message ?? "PocketBase request failed.";
}

/** Auth routes — maps sign-in failures without leaking whether the email exists when possible. */
export function pocketBaseAuthErrorMessage(error: unknown, context: "signup" | "login"): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : context === "signup" ? "Could not create account." : "Sign-in failed.";
  }
  if (context === "login") {
    return loginFailureMessage(error);
  }
  return pocketBaseErrorMessage(error);
}
