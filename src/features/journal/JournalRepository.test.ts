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

    await repository.setEntryMood("2026-08-21", "😊");
    expect(execute).toHaveBeenLastCalledWith(expect.stringContaining("mood_emoji"), [
      "entry-1", "2026-08-21", "😊", "2026-08-21T00:00:00.000Z",
    ]);
  });

  it("creates and loads ordered todos", async () => {
    const select = vi.fn()
      .mockResolvedValueOnce([{ next_order: 2 }])
      .mockResolvedValueOnce([{
        id: "todo-1", todo_date: "2026-08-21", content: "写实验记录",
        is_completed: 0, sort_order: 2, due_time: "18:30", priority: "high",
        created_at: "2026-08-21T00:00:00.000Z", updated_at: "2026-08-21T00:00:00.000Z",
      }]);
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new JournalRepository(
      { execute, select } as unknown as DatabasePort,
      () => "todo-1",
      () => "2026-08-21T00:00:00.000Z",
    );
    await expect(repository.createTodo("2026-08-21", " 写实验记录 ", {
      dueTime: "18:30",
      priority: "high",
    })).resolves.toBe("todo-1");
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO todos"), [
      "todo-1", "2026-08-21", "写实验记录", 2, "18:30", "high", "2026-08-21T00:00:00.000Z",
    ]);
    await expect(repository.listTodos("2026-08-21")).resolves.toEqual([expect.objectContaining({
      id: "todo-1", isCompleted: false, sortOrder: 2, dueTime: "18:30", priority: "high",
    })]);
    expect(select).toHaveBeenLastCalledWith(expect.stringContaining("ORDER BY is_completed"), ["2026-08-21"]);
  });

  it("validates and updates optional todo details", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new JournalRepository(
      { execute, select: vi.fn() } as unknown as DatabasePort,
      () => "unused",
      () => "2026-08-21T00:00:00.000Z",
    );

    await repository.updateTodoDetails("todo-1", { dueTime: "09:15", priority: "medium" });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("due_time = $1"), [
      "09:15", "medium", "2026-08-21T00:00:00.000Z", "todo-1",
    ]);
    await expect(repository.updateTodoDetails("todo-1", { dueTime: "25:00", priority: null }))
      .rejects.toThrow("截止时刻格式无效");
  });

  it("moves a newly completed todo to the final sort position", async () => {
    const execute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const repository = new JournalRepository(
      { execute, select: vi.fn() } as unknown as DatabasePort,
      () => "unused",
      () => "2026-08-21T00:00:00.000Z",
    );

    await repository.setTodoCompleted("todo-1", true);
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("MAX(peer.sort_order)"), [
      1, "2026-08-21T00:00:00.000Z", "todo-1",
    ]);
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
