import { describe, expect, it } from "vitest";
import { formatLunarDate } from "./lunar";

describe("formatLunarDate", () => {
  it("formats a regular lunar day for compact and full calendar labels", () => {
    expect(formatLunarDate("2026-08-30")).toEqual({
      yearName: "丙午",
      month: "七月",
      day: "十八",
      compact: "十八",
      full: "丙午年七月十八",
    });
  });

  it("uses the lunar month name on the first day", () => {
    expect(formatLunarDate("2026-02-17")).toMatchObject({
      month: "正月",
      day: "初一",
      compact: "正月",
    });
  });
});
