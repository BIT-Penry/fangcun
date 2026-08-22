import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { JournalProvider } from "../journal/JournalContext";
import type { JournalStore } from "../journal/types";
import { HomePage } from "./HomePage";

const journal: JournalStore = {
  getEntry: vi.fn().mockResolvedValue(""),
  getEntryMood: vi.fn().mockResolvedValue(null),
  saveEntry: vi.fn().mockResolvedValue(undefined),
  setEntryMood: vi.fn().mockResolvedValue(undefined),
  listTodos: vi.fn().mockResolvedValue([]),
  createTodo: vi.fn().mockResolvedValue("todo-1"),
  updateTodoContent: vi.fn().mockResolvedValue(undefined),
  updateTodoDetails: vi.fn().mockResolvedValue(undefined),
  setTodoCompleted: vi.fn().mockResolvedValue(undefined),
  moveTodo: vi.fn().mockResolvedValue(undefined),
  reorderTodos: vi.fn().mockResolvedValue(undefined),
  deleteTodo: vi.fn().mockResolvedValue(undefined),
  searchJournal: vi.fn().mockResolvedValue([]),
};

describe("HomePage", () => {
  it("switches days and links to the selected full journal", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><JournalProvider repository={journal}><HomePage /></JournalProvider></MemoryRouter>);
    const initialLink = screen.getByRole("link", { name: /打开完整日记/ });
    const initialTarget = initialLink.getAttribute("href");
    await user.click(screen.getByRole("button", { name: "前一天" }));
    expect(initialLink.getAttribute("href")).not.toBe(initialTarget);
    await user.click(screen.getByRole("button", { name: "今天" }));
    expect(initialLink.getAttribute("href")).toBe(initialTarget);
  });
});
