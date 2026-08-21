import { describe, expect, it, vi } from "vitest";
import type { DatabasePort } from "../../shared/db/types";
import { JournalRepository } from "./JournalRepository";

describe("JournalRepository", () => {
  it("upserts one daily entry per date", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new JournalRepository(
      { execute, select: vi.fn() } as unknown as DatabasePort,
      () => "entry-1",
      () => "2026-08-21T00:00:00.000Z",
    );
    await repository.saveEntry("2026-08-21", "保留换行\n第二行");
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT(entry_date)"), [
      "entry-1", "2026-08-21", "保留换行\n第二行", "2026-08-21T00:00:00.000Z",
    ]);
  });

  it("creates and loads ordered todos", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{ next_order: 2 }])
      .mockResolvedValueOnce([{
        id: "todo-1", todo_date: "2026-08-21", content: "写实验记录",
        is_completed: 0, sort_order: 2,
        created_at: "2026-08-21T00:00:00.000Z", updated_at: "2026-08-21T00:00:00.000Z",
      }]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new JournalRepository(
      { execute, select } as unknown as DatabasePort,
      () => "todo-1",
      () => "2026-08-21T00:00:00.000Z",
    );
    await expect(repository.createTodo("2026-08-21", " 写实验记录 ")).resolves.toBe("todo-1");
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO todos"), [
      "todo-1", "2026-08-21", "写实验记录", 2, "2026-08-21T00:00:00.000Z",
    ]);
    await expect(repository.listTodos("2026-08-21")).resolves.toEqual([expect.objectContaining({
      id: "todo-1", isCompleted: false, sortOrder: 2,
    })]);
  });

  it("persists an explicit reorder", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const select = vi.fn().mockResolvedValue([
      { id: "todo-a", sort_order: 0, updated_at: "2026-08-20T00:00:00.000Z" },
      { id: "todo-b", sort_order: 1, updated_at: "2026-08-20T00:00:00.000Z" },
    ]);
    const repository = new JournalRepository(
      { execute, select } as unknown as DatabasePort,
      () => "unused",
      () => "2026-08-21T00:00:00.000Z",
    );
    await repository.reorderTodos(["todo-b", "todo-a"]);
    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining("sort_order = $1"), [0, "2026-08-21T00:00:00.000Z", "todo-b"]);
    expect(execute).toHaveBeenNthCalledWith(2, expect.stringContaining("sort_order = $1"), [1, "2026-08-21T00:00:00.000Z", "todo-a"]);
  });
});
