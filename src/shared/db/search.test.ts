import { describe, expect, it } from "vitest";
import { likePattern } from "./search";

describe("likePattern", () => {
  it("escapes LIKE wildcard characters", () => {
    expect(likePattern("100%_done\\ok")).toBe("%100\\%\\_done\\\\ok%");
  });
});
