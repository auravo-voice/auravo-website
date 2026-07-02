import { describe, expect, it } from "vitest";
import {
  emailLocalPart,
  extractGoogleProfileName,
  isNumericOnlyDisplayName,
  needsDisplayNameRepair,
  readDisplayName,
  repairDisplayNameIfNeeded,
  resolveDisplayName,
  resolveOAuthDisplayNameUpdate,
  storedDisplayNameIsReplaceable,
  storedDisplayNamesCanUpgrade,
} from "@/lib/auth/display-name";

describe("isNumericOnlyDisplayName", () => {
  it("detects Google OAuth subject ids", () => {
    expect(isNumericOnlyDisplayName("105107825743407948522")).toBe(true);
  });

  it("allows normal names and mixed values", () => {
    expect(isNumericOnlyDisplayName("saddam.husen1997")).toBe(false);
    expect(isNumericOnlyDisplayName("User 123")).toBe(false);
    expect(isNumericOnlyDisplayName("")).toBe(false);
    expect(isNumericOnlyDisplayName("  ")).toBe(false);
  });
});

describe("resolveDisplayName", () => {
  it("rejects numeric-only profile names", () => {
    expect(
      resolveDisplayName({
        profileName: "105107825743407948522",
        email: "saddam.husen1997@gmail.com",
      }),
    ).toBe("saddam.husen1997");
  });

  it("keeps valid profile names", () => {
    expect(resolveDisplayName({ profileName: "Saddam Husen", email: "a@b.com" })).toBe(
      "Saddam Husen",
    );
  });

  it("falls back to Learner without email", () => {
    expect(resolveDisplayName({ profileName: "999" })).toBe("Learner");
  });
});

describe("repairDisplayNameIfNeeded", () => {
  it("returns null when both fields are valid", () => {
    expect(
      repairDisplayNameIfNeeded({
        name: "Ada Lovelace",
        display_name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    ).toBeNull();
  });

  it("repairs numeric fields using email prefix", () => {
    expect(
      repairDisplayNameIfNeeded({
        name: "105107825743407948522",
        display_name: "105107825743407948522",
        email: "saddam.husen1997@gmail.com",
      }),
    ).toBe("saddam.husen1997");
  });

  it("prefers a valid name when only display_name is numeric", () => {
    expect(
      repairDisplayNameIfNeeded({
        name: "Saddam Husen",
        display_name: "105107825743407948522",
        email: "saddam.husen1997@gmail.com",
      }),
    ).toBe("Saddam Husen");
  });

  it("prefers Google profile name when both fields are numeric", () => {
    expect(
      repairDisplayNameIfNeeded({
        name: "105107825743407948522",
        display_name: "105107825743407948522",
        email: "saddam.husen1997@gmail.com",
        googleProfileName: "Saddam Husen",
      }),
    ).toBe("Saddam Husen");
  });
});

describe("needsDisplayNameRepair", () => {
  it("is true when either field is numeric-only", () => {
    expect(needsDisplayNameRepair({ name: "123", display_name: "Ada" })).toBe(true);
    expect(needsDisplayNameRepair({ name: "Ada", display_name: "456" })).toBe(true);
    expect(needsDisplayNameRepair({ name: "Ada", display_name: "Ada" })).toBe(false);
  });
});

describe("readDisplayName", () => {
  it("skips numeric-only values at read time", () => {
    expect(
      readDisplayName({
        name: "105107825743407948522",
        display_name: "105107825743407948522",
        email: "saddam.husen1997@gmail.com",
      }),
    ).toBe("saddam.husen1997");
  });
});

describe("emailLocalPart", () => {
  it("extracts the local part", () => {
    expect(emailLocalPart("saddam.husen1997@gmail.com")).toBe("saddam.husen1997");
  });
});

describe("extractGoogleProfileName", () => {
  it("reads meta.name", () => {
    expect(extractGoogleProfileName({ name: "Saddam Husen" })).toBe("Saddam Husen");
  });

  it("falls back to meta.rawUser.name", () => {
    expect(
      extractGoogleProfileName({
        name: "",
        rawUser: { name: "Saddam Husen" },
      }),
    ).toBe("Saddam Husen");
  });

  it("rejects numeric-only meta.name and uses rawUser when present", () => {
    expect(
      extractGoogleProfileName({
        name: "105107825743407948522",
        rawUser: { name: "Saddam Husen" },
      }),
    ).toBe("Saddam Husen");
  });
});

describe("storedDisplayNameIsReplaceable", () => {
  it("treats empty, numeric, and email-prefix values as replaceable", () => {
    const email = "saddam.husen1997@gmail.com";
    expect(storedDisplayNameIsReplaceable("", email)).toBe(true);
    expect(storedDisplayNameIsReplaceable("105107825743407948522", email)).toBe(true);
    expect(storedDisplayNameIsReplaceable("saddam.husen1997", email)).toBe(true);
  });

  it("treats custom human names as protected", () => {
    expect(storedDisplayNameIsReplaceable("Sachin Pradeep", "sachin@example.com")).toBe(false);
  });
});

describe("resolveOAuthDisplayNameUpdate", () => {
  const email = "saddam.husen1997@gmail.com";

  it("upgrades numeric id to Google profile name", () => {
    expect(
      resolveOAuthDisplayNameUpdate({
        name: "105107825743407948522",
        display_name: "105107825743407948522",
        email,
        googleProfileName: "Saddam Husen",
      }),
    ).toBe("Saddam Husen");
  });

  it("upgrades email prefix to Google profile name", () => {
    expect(
      resolveOAuthDisplayNameUpdate({
        name: "saddam.husen1997",
        display_name: "saddam.husen1997",
        email,
        googleProfileName: "Saddam Husen",
      }),
    ).toBe("Saddam Husen");
  });

  it("does not overwrite valid custom names", () => {
    expect(
      resolveOAuthDisplayNameUpdate({
        name: "Sachin Pradeep",
        display_name: "Sachin Pradeep",
        email: "sachin.pradeep@gmail.com",
        googleProfileName: "Sachin Pradeep",
      }),
    ).toBeNull();
  });

  it("does not overwrite custom names that differ from the email prefix", () => {
    expect(
      resolveOAuthDisplayNameUpdate({
        name: "Custom Learner",
        display_name: "Custom Learner",
        email: "learner@gmail.com",
        googleProfileName: "Google Name",
      }),
    ).toBeNull();
  });

  it("falls back to numeric repair when Google name is missing", () => {
    expect(
      resolveOAuthDisplayNameUpdate({
        name: "105107825743407948522",
        display_name: "105107825743407948522",
        email,
      }),
    ).toBe("saddam.husen1997");
  });

  it("returns null for email-prefix names when Google name is missing", () => {
    expect(
      resolveOAuthDisplayNameUpdate({
        name: "saddam.husen1997",
        display_name: "saddam.husen1997",
        email,
      }),
    ).toBeNull();
  });
});

describe("storedDisplayNamesCanUpgrade", () => {
  it("requires both fields to be replaceable", () => {
    expect(
      storedDisplayNamesCanUpgrade({
        name: "Sachin Pradeep",
        display_name: "sachin",
        email: "sachin@gmail.com",
      }),
    ).toBe(false);
  });
});
