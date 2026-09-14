import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseSkillFile, parseSkillFrontmatter, parseSkillZip, parseSkillZipCollection, skillMarkdownBody } from "./import";

describe("skill import", () => {
  it("reads name and description from SKILL.md frontmatter", () => {
    expect(parseSkillFrontmatter("---\nname: paper-reader\ndescription: '精读论文'\n---\n# Instructions"))
      .toEqual({ name: "paper-reader", description: "精读论文" });
  });

  it("reads folded and literal YAML descriptions instead of exposing scalar markers", () => {
    expect(parseSkillFrontmatter("---\nname: reviewer\ndescription: >-\n  Review manuscripts and\n  produce reports.\n---\n# Steps").description)
      .toBe("Review manuscripts and produce reports.");
    expect(parseSkillFrontmatter("---\nname: writer\ndescription: |\n  Draft papers.\n  Preserve evidence.\n---\n# Steps").description)
      .toBe("Draft papers.\nPreserve evidence.");
  });

  it("removes frontmatter only from the rendered Markdown body", () => {
    expect(skillMarkdownBody("---\nname: reviewer\ndescription: Review code\n---\n\n# Steps\n\nDo the work."))
      .toBe("# Steps\n\nDo the work.");
    expect(skillMarkdownBody("# Plain Markdown\n\nNo frontmatter."))
      .toBe("# Plain Markdown\n\nNo frontmatter.");
    expect(skillMarkdownBody("---\nnot closed"))
      .toBe("---\nnot closed");
  });

  it("imports a Markdown skill without executing its content", () => {
    const input = parseSkillFile("SKILL.md", strToU8("---\nname: review\ndescription: Review code\n---\n\n# Steps"));
    expect(input).toEqual(expect.objectContaining({
      name: "review", description: "Review code", packageType: "markdown", resources: [],
      compatibility: ["通用 Markdown"],
    }));
  });

  it("imports a ZIP package, resources, and an optional cover", () => {
    const archive = zipSync({
      "review/SKILL.md": strToU8("---\nname: review\ndescription: Review code\n---\n# Steps"),
      "review/scripts/check.py": strToU8("print('stored only')"),
      "review/references/rules.md": strToU8("# Rules"),
      "review/assets/cover.png": new Uint8Array([137, 80, 78, 71]),
    });
    const input = parseSkillZip("review.zip", archive);
    expect(input.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "scripts/check.py", kind: "script" }),
      expect.objectContaining({ path: "references/rules.md", kind: "reference" }),
      expect.objectContaining({ path: "assets/cover.png", kind: "asset" }),
    ]));
    expect(input.coverDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects ZIP files without SKILL.md", () => {
    expect(() => parseSkillZip("broken.zip", zipSync({ "README.md": strToU8("missing") })))
      .toThrow("没有找到 SKILL.md");
  });

  it("imports every independent Skill from a repository archive", () => {
    const archive = zipSync({
      "collection-main/skills/reader/SKILL.md": strToU8("---\nname: reader\ndescription: Read papers\n---\n# Reader"),
      "collection-main/skills/reader/references/rules.md": strToU8("# Rules"),
      "collection-main/skills/writer/SKILL.md": strToU8("---\nname: writer\ndescription: Write papers\n---\n# Writer"),
      "collection-main/README.md": strToU8("# Collection"),
    });
    const inputs = parseSkillZipCollection("collection.zip", archive);
    expect(inputs.map((input) => input.name)).toEqual(["reader", "writer"]);
    expect(inputs[0].resources).toEqual([
      expect.objectContaining({ path: "references/rules.md", kind: "reference" }),
    ]);
    expect(inputs.every((input) => input.packageData && input.packageData.byteLength < archive.byteLength)).toBe(true);
  });
});
