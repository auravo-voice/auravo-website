import { describe, expect, it } from "vitest";
import { ClientResponseError } from "pocketbase";

import { pocketBaseAuthErrorMessage, pocketBaseErrorMessage } from "@/lib/pocketbase/errors";

function pbError(status: number, message: string, data?: Record<string, unknown>): ClientResponseError {
  return new ClientResponseError({
    url: "https://pb.example/api/collections/users/records",
    status,
    response: { message, data },
    isAbort: false,
    originalError: null,
  });
}

describe("pocketBaseErrorMessage", () => {
  it("maps duplicate email to a friendly signup message", () => {
    const err = pbError(400, "Failed to create record.", {
      email: { code: "validation_not_unique", message: "Value must be unique." },
    });
    expect(pocketBaseErrorMessage(err)).toBe("This email is already registered — try signing in instead.");
  });

  it("maps short password to a friendly message", () => {
    const err = pbError(400, "Failed to create record.", {
      password: { code: "validation_min_text_constraint", message: "Must be at least 8 character(s)." },
    });
    expect(pocketBaseErrorMessage(err)).toBe("Password must be at least 8 characters.");
  });

  it("maps password mismatch", () => {
    const err = pbError(400, "Failed to create record.", {
      passwordConfirm: { code: "validation_values_mismatch", message: "Values don't match." },
    });
    expect(pocketBaseErrorMessage(err)).toBe("Passwords don't match.");
  });

  it("falls back to PocketBase top-level message", () => {
    const err = pbError(503, "Service unavailable.");
    expect(pocketBaseErrorMessage(err)).toBe("Service unavailable.");
  });
});

describe("pocketBaseAuthErrorMessage", () => {
  it("maps login authentication failures", () => {
    const err = pbError(400, "Failed to authenticate.");
    expect(pocketBaseAuthErrorMessage(err, "login")).toBe("Invalid email or password.");
  });

  it("uses signup field messages in signup context", () => {
    const err = pbError(400, "Failed to create record.", {
      email: { code: "validation_is_email", message: "Must be a valid email address." },
    });
    expect(pocketBaseAuthErrorMessage(err, "signup")).toBe("Enter a valid email address.");
  });
});
