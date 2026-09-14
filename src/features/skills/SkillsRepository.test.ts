import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../../shared/db/types";
import { SkillsRepository } from "./SkillsRepository";

const input = {
  name: " 论文精读 ", description: "读懂方法", content: "# Instructions", notes: "",
  sourceName: "paper.zip", packageType: "zip" as const, packageData: new Uint8Array([1, 2]),
  coverDataUrl: null, isFavorite: true, tags: ["研究", "研究"], compatibility: ["Codex"],
  resources: [{ path: "scripts/run.py", kind: "script" as const, size: 12 }],
};

describe("SkillsRepository", () => {
  it("loads skills with parsed metadata and independent tags", async () => {
    const db = {
      select: vi.fn()
        .mockResolvedValueOnce([{
          id: "skill-1", name: "论文精读", description: "读懂方法", content: "# Instructions", notes: "",
          source_name: "paper.zip", package_type: "zip", package_data: new Uint8Array([1]), cover_data_url: null,
          is_favorite: 1, compatibility_json: '["Codex"]', resources_json: '[{"path":"scripts/run.py","kind":"script","size":12}]',
          created_at: "2026-08-24T00:00:00.000Z", updated_at: "2026-08-24T00:00:00.000Z",
        }])
        .mockResolvedValueOnce([{ skill_id: "skill-1", name: "研究" }]),
      execute: vi.fn(),
    } as unknown as DatabasePort;
    await expect(new SkillsRepository(db).listSkills()).resolves.toEqual([
      expect.objectContaining({ id: "skill-1", isFavorite: true, tags: ["研究"], compatibility: ["Codex"] }),
    ]);
    expect(db.select).toHaveBeenNthCalledWith(1, expect.stringContaining("NULL AS package_data"));
  });

  it("creates a skill and deduplicates tags", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const select = vi.fn().mockResolvedValue([{ id: "tag-1" }]);
    const ids = ["skill-1", "tag-proposal"];
    const repository = new SkillsRepository(
      { execute, select } as unknown as DatabasePort,
      () => ids.shift() ?? "extra-id",
      () => "2026-08-24T00:00:00.000Z",
    );
    await expect(repository.createSkill(input)).resolves.toBe("skill-1");
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO skills"), expect.arrayContaining([
      "skill-1", "论文精读", "读懂方法", "# Instructions",
    ]));
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("rejects an empty SKILL.md", async () => {
    const db = { select: vi.fn(), execute: vi.fn() } as unknown as DatabasePort;
    await expect(new SkillsRepository(db).createSkill({ ...input, content: " " })).rejects.toThrow("SKILL.md 内容不能为空");
    expect(db.execute).not.toHaveBeenCalled();
  });
});
