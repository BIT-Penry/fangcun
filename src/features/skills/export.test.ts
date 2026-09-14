import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildSkillCollectionExport, buildSkillExport, referencedSkillNames } from "./export";
import type { Skill } from "./types";

function skill(overrides: Partial<Skill>): Skill {
  const name = overrides.name ?? "paper-reader";
  const content = overrides.content ?? `---\nname: ${name}\ndescription: Test\n---\n`;
  return {
    id: name,
    name,
    description: "Test",
    content,
    notes: "",
    sourceName: "SKILL.md",
    packageType: "markdown",
    packageData: null,
    coverDataUrl: null,
    isFavorite: false,
    tags: [],
    compatibility: [],
    resources: [],
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("skill exports", () => {
  it("detects sibling skill dependencies", () => {
    expect(referencedSkillNames(skill({ content: "Read ../nature-shared/core/rules.md twice ../nature-shared/other.md" })))
      .toEqual(["nature-shared"]);
  });

  it("automatically includes a referenced shared skill", () => {
    const primary = skill({
      name: "nature-reader",
      content: "---\nname: nature-reader\ndescription: Test\n---\nUse ../nature-shared/core/rules.md",
      packageType: "zip",
      packageData: zipSync({ "SKILL.md": strToU8("old"), "references/local.md": strToU8("local") }),
    });
    const shared = skill({
      name: "nature-shared",
      packageType: "zip",
      packageData: zipSync({ "SKILL.md": strToU8("old shared"), "core/rules.md": strToU8("rules") }),
    });

    const archive = buildSkillExport(primary, [primary, shared]);
    const files = unzipSync(archive.data);
    expect(Object.keys(files)).toContain("nature-reader/SKILL.md");
    expect(Object.keys(files)).toContain("nature-reader/references/local.md");
    expect(Object.keys(files)).toContain("nature-shared/core/rules.md");
    expect(strFromU8(files["nature-reader/SKILL.md"])).toBe(primary.content);
    expect(archive.includedSkillNames).toEqual(["nature-reader", "nature-shared"]);
    expect(archive.missingDependencies).toEqual([]);
  });

  it("reports dependencies that are not in the library", () => {
    const primary = skill({ content: "Use ../missing-shared/rules.md" });
    expect(buildSkillExport(primary, [primary]).missingDependencies).toEqual(["missing-shared"]);
  });

  it("exports a collection as sibling skill folders", () => {
    const one = skill({ name: "one" });
    const two = skill({ name: "two" });
    const archive = buildSkillCollectionExport("Example Skills", [one, two]);
    expect(Object.keys(unzipSync(archive.data)).sort()).toEqual(["one/SKILL.md", "two/SKILL.md"]);
    expect(archive.filename).toBe("Example-Skills.zip");
  });
});
