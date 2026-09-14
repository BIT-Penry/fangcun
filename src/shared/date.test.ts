import { describe, expect, it } from "vitest";
import { addLocalDays, localDateKey, parseLocalDate } from "./date";

describe("local date helpers", () => {
  it("round-trips a local calendar date", () => {
    expect(localDateKey(parseLocalDate("2026-08-21"))).toBe("2026-08-21");
  });

  it("moves across month boundaries", () => {
    expect(addLocalDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addLocalDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
