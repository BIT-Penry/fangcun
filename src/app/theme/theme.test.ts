import { describe, expect, it } from "vitest";
import { applyTheme, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"],
  ] as const)("resolves %s with systemDark=%s", (preference, systemDark, expected) => {
    expect(resolveTheme(preference, systemDark)).toBe(expected);
  });
});

describe("applyTheme", () => {
  it("writes the resolved theme to the document root", () => {
    const root = document.createElement("div");
    applyTheme(root, "dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });
});
