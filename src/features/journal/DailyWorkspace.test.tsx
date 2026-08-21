import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JournalProvider } from "./JournalContext";
import { DailyWorkspace } from "./DailyWorkspace";
import type { JournalStore, Todo } from "./types";

const todo: Todo = {
  id: "todo-1", date: "2026-08-21", content: "写实验记录", isCompleted: false, sortOrder: 0,
  createdAt: "2026-08-21T00:00:00.000Z", updatedAt: "2026-08-21T00:00:00.000Z",
};

function createStore(overrides: Partial<JournalStore> = {}): JournalStore {
  return {
    getEntry: vi.fn().mockResolvedValue("今天完成了测试。"),
    saveEntry: vi.fn().mockResolvedValue(undefined),
    listTodos: vi.fn().mockResolvedValue([todo]),
    createTodo: vi.fn().mockResolvedValue("todo-new"),
    updateTodoContent: vi.fn().mockResolvedValue(undefined),
    setTodoCompleted: vi.fn().mockResolvedValue(undefined),
    moveTodo: vi.fn().mockResolvedValue(undefined),
    reorderTodos: vi.fn().mockResolvedValue(undefined),
    deleteTodo: vi.fn().mockResolvedValue(undefined),
    searchJournal: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function renderWorkspace(store: JournalStore) {
  return render(<JournalProvider repository={store}><DailyWorkspace date="2026-08-21" /></JournalProvider>);
}

describe("DailyWorkspace", () => {
  it("loads and updates the daily todo list", async () => {
    const user = userEvent.setup();
    const store = createStore();
    renderWorkspace(store);
    expect(await screen.findByDisplayValue("写实验记录")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "完成 写实验记录" }));
    await waitFor(() => expect(store.setTodoCompleted).toHaveBeenCalledWith("todo-1", true));
    await user.type(screen.getByLabelText("新增 Todo"), "整理图表");
    await user.click(screen.getByRole("button", { name: "添加 Todo" }));
    await waitFor(() => expect(store.createTodo).toHaveBeenCalledWith("2026-08-21", "整理图表"));
  });

  it("autosaves the daily entry", async () => {
    const user = userEvent.setup();
    const store = createStore();
    renderWorkspace(store);
    const entry = await screen.findByLabelText("每日随笔");
    await user.type(entry, " 新进展");
    window.dispatchEvent(new Event("blur"));
    await waitFor(() => expect(store.saveEntry).toHaveBeenCalledWith("2026-08-21", "今天完成了测试。 新进展"), { timeout: 2000 });
  });
});
