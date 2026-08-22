import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { JournalProvider } from "./JournalContext";
import { DailyWorkspace } from "./DailyWorkspace";
import type { JournalStore, Todo } from "./types";

const todo: Todo = {
  id: "todo-1", date: "2026-08-21", content: "写实验记录", isCompleted: false, sortOrder: 0,
  dueTime: null, priority: null,
  createdAt: "2026-08-21T00:00:00.000Z", updatedAt: "2026-08-21T00:00:00.000Z",
};

function createStore(overrides: Partial<JournalStore> = {}): JournalStore {
  return {
    getEntry: vi.fn().mockResolvedValue("今天完成了测试。"),
    getEntryMood: vi.fn().mockResolvedValue(null),
    saveEntry: vi.fn().mockResolvedValue(undefined),
    setEntryMood: vi.fn().mockResolvedValue(undefined),
    listTodos: vi.fn().mockResolvedValue([todo]),
    createTodo: vi.fn().mockResolvedValue("todo-new"),
    updateTodoContent: vi.fn().mockResolvedValue(undefined),
    updateTodoDetails: vi.fn().mockResolvedValue(undefined),
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
  it("moves completed todos below unfinished todos", async () => {
    const user = userEvent.setup();
    const completedTodo = { ...todo, id: "todo-2", content: "已经完成", isCompleted: true, sortOrder: 1 };
    const store = createStore({ listTodos: vi.fn().mockResolvedValue([todo, completedTodo]) });
    renderWorkspace(store);
    expect(await screen.findByDisplayValue("写实验记录")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "完成 写实验记录" }));
    await waitFor(() => expect(store.setTodoCompleted).toHaveBeenCalledWith("todo-1", true));
    expect(screen.getAllByLabelText(/^Todo：/).map((input) => (input as HTMLInputElement).value))
      .toEqual(["已经完成", "写实验记录"]);
  });

  it("adds and edits optional todo details", async () => {
    const user = userEvent.setup();
    const store = createStore();
    renderWorkspace(store);
    await screen.findByDisplayValue("写实验记录");
    await user.click(screen.getByRole("button", { name: "添加截止时刻和优先级" }));
    fireEvent.change(screen.getByLabelText("新 Todo 截止时刻"), { target: { value: "18:30" } });
    await user.selectOptions(screen.getByLabelText("新 Todo 优先级"), "high");
    await user.type(screen.getByLabelText("新增 Todo"), "整理图表");
    await user.click(screen.getByRole("button", { name: "添加 Todo" }));
    await waitFor(() => expect(store.createTodo).toHaveBeenCalledWith("2026-08-21", "整理图表", {
      dueTime: "18:30", priority: "high",
    }));

    await user.click(screen.getByRole("button", { name: "任务详情 写实验记录" }));
    fireEvent.change(screen.getByLabelText("设置 写实验记录 的截止时刻"), { target: { value: "09:15" } });
    await waitFor(() => expect(store.updateTodoDetails).toHaveBeenCalledWith("todo-1", {
      dueTime: "09:15", priority: null,
    }));
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

  it("previews Markdown and supports entry and mood emoji", async () => {
    const user = userEvent.setup();
    const store = createStore({ getEntry: vi.fn().mockResolvedValue("# 今日进展") });
    renderWorkspace(store);

    await user.click(await screen.findByRole("button", { name: "预览" }));
    expect(screen.getByRole("heading", { name: "今日进展" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "插入 Emoji" }));
    await user.click(screen.getByRole("button", { name: "插入表情 😊" }));
    await waitFor(() => expect(screen.getByLabelText("每日随笔")).toHaveValue("# 今日进展😊"));

    await user.click(screen.getByRole("button", { name: "选择今日状态" }));
    await user.click(screen.getByRole("button", { name: "设为今日状态 😊" }));
    await waitFor(() => expect(store.setEntryMood).toHaveBeenCalledWith("2026-08-21", "😊"));
  });
});
