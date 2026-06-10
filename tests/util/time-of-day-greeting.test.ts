import { describe, expect, it } from "vitest";

import { getTimeOfDayGreeting } from "@/lib/util/time-of-day-greeting";

describe("getTimeOfDayGreeting", () => {
  it("returns morning, afternoon, and evening by local hour", () => {
    expect(getTimeOfDayGreeting(8)).toBe("Good morning");
    expect(getTimeOfDayGreeting(14)).toBe("Good afternoon");
    expect(getTimeOfDayGreeting(19)).toBe("Good evening");
  });

  it("uses Hello for late night and early morning", () => {
    expect(getTimeOfDayGreeting(2)).toBe("Hello");
    expect(getTimeOfDayGreeting(23)).toBe("Hello");
  });
});
