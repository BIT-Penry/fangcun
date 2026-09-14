import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { JournalProvider } from "./JournalContext";
import { JournalPage } from "./JournalPage";
import type { JournalStore } from "./types";

function createStore(): JournalStore {
  return {
    getEntry: vi.fn().mockResolvedValue(""),
    getEntryMood: vi.fn().mockResolvedValue(null),
    saveEntry: vi.fn().mockResolvedValue(undefined),
    setEntryMood: vi.fn().mockResolvedValue(undefined),
    listTodos: vi.fn().mockResolvedValue([]),
    createTodo: vi.fn().mockResolvedValue("todo-new"),
    updateTodoContent: vi.fn().mockResolvedValue(undefined),
    updateTodoDetails: vi.fn().mockResolvedValue(undefined),
    setTodoCompleted: vi.fn().mockResolvedValue(undefined),
    moveTodo: vi.fn().mockResolvedValue(undefined),
    reorderTodos: vi.fn().mockResolvedValue(undefined),
    deleteTodo: vi.fn().mockResolvedValue(undefined),
    getMonthSummary: vi.fn().mockResolvedValue({
      entryDays: 0, todoCount: 2, completedTodoCount: 0,
      p1TodoCount: 0, p2TodoCount: 0, p3TodoCount: 2,
    }),
    getOpenTodoCounts: vi.fn().mockResolvedValue({ "2026-08-23": 2 }),
    searchJournal: vi.fn().mockResolvedValue([]),
  };
}

describe("JournalPage", () => {
  it("marks calendar dates that still have unfinished todos", async () => {
    const store = createStore();
    render(
      <MemoryRouter initialEntries={["/journal?date=2026-08-24"]}>
        <JournalProvider repository={store}><JournalPage /></JournalProvider>
      </MemoryRouter>,
    );

    const day = await screen.findByRole("button", { name: /2026年8月23日.*2项任务未完成/ });
    expect(day).toHaveClass("has-open-todos");
    expect(day).toHaveAttribute("title", "2 项任务未完成");
    expect(day.querySelector(".calendar-open-todos")).toHaveAttribute("data-level", "some");
    expect(day.querySelector(".calendar-open-todos")).toHaveAttribute("data-count", "2");
    await waitFor(() => expect(store.getOpenTodoCounts).toHaveBeenCalledWith("2026-07-27", "2026-09-07"));
  });
});
