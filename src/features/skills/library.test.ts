import { describe, expect, it } from "vitest";
import { collectionNameFromSource, groupSkillsBySource } from "./library";
import type { Skill } from "./types";

function skill(overrides: Partial<Skill>): Skill {
  return {
    id: overrides.name ?? "skill",
    name: "paper-reader",
    description: "Read papers",
    content: "---\nname: paper-reader\ndescription: Read papers\n---\n",
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

describe("skill collections", () => {
  it("groups multiple skills imported from the same link", () => {
    const sourceName = "https://github.com/Yuan1z0825/nature-skills";
    const result = groupSkillsBySource([
      skill({ id: "one", name: "nature-reader", sourceName, tags: ["文献阅读", "论文翻译"] }),
      skill({ id: "two", name: "nature-writing", sourceName, tags: ["论文写作", "文献阅读"] }),
      skill({ id: "three", name: "local-skill", sourceName: "SKILL.md" }),
    ]);

    expect(result.collections).toHaveLength(1);
    expect(result.collections[0].name).toBe("Nature Skills");
    expect(result.collections[0].skills).toHaveLength(2);
    expect(result.collections[0].tags).toEqual(["文献阅读", "论文翻译"]);
    expect(result.singles.map((item) => item.name)).toEqual(["local-skill"]);
  });

  it("keeps a single linked skill as an individual item", () => {
    const result = groupSkillsBySource([
      skill({ name: "one", sourceName: "https://github.com/example/one" }),
    ]);
    expect(result.collections).toHaveLength(0);
    expect(result.singles).toHaveLength(1);
  });

  it("derives readable collection names", () => {
    expect(collectionNameFromSource("https://github.com/example/ai-agent-skills")).toBe("AI Agent Skills");
  });
});
