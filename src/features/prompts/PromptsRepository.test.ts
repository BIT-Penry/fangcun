import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../../shared/db/types";
import { PromptsRepository } from "./PromptsRepository";

describe("PromptsRepository", () => {
  it("loads prompts with independent tags", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{
        id: "prompt-1",
        title: "论文摘要",
        content: "Summarize the paper.",
        notes: "用于精读",
        is_favorite: 1,
        created_at: "2026-08-21T00:00:00.000Z",
        updated_at: "2026-08-21T00:00:00.000Z",
      }])
      .mockResolvedValueOnce([{ prompt_id: "prompt-1", name: "研究" }]);
    const db = { select, execute: vi.fn() } as unknown as DatabasePort;

    await expect(new PromptsRepository(db).listPrompts()).resolves.toEqual([expect.objectContaining({
      id: "prompt-1",
      isFavorite: true,
      tags: ["研究"],
    })]);
  });

  it("creates a prompt and removes duplicate tags", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const select = vi.fn().mockResolvedValueOnce([{ id: "tag-1" }]);
    const ids = ["prompt-1", "tag-proposal"];
    const repository = new PromptsRepository(
      { execute, select } as unknown as DatabasePort,
      () => ids.shift() ?? "extra-id",
      () => "2026-08-21T00:00:00.000Z",
    );

    await expect(repository.createPrompt({
      title: " 摘要 ",
      content: "Keep\nline breaks",
      notes: "note",
      isFavorite: true,
      tags: ["研究", "研究", ""],
    })).resolves.toBe("prompt-1");
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO prompts"), [
      "prompt-1", "摘要", "Keep\nline breaks", "note", 1, "2026-08-21T00:00:00.000Z",
    ]);
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("rejects blank content", async () => {
    const db = { select: vi.fn(), execute: vi.fn() } as unknown as DatabasePort;
    const repository = new PromptsRepository(db);
    await expect(repository.createPrompt({
      title: "空内容", content: "  ", notes: "", isFavorite: false, tags: [],
    })).rejects.toThrow("提示词正文不能为空");
    expect(db.execute).not.toHaveBeenCalled();
  });
});
