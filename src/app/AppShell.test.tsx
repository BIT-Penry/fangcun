import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { BookmarksProvider } from "../features/bookmarks/BookmarksContext";
import type { BookmarksStore } from "../features/bookmarks/types";
import { JournalProvider } from "../features/journal/JournalContext";
import type { JournalStore } from "../features/journal/types";
import { PromptsProvider } from "../features/prompts/PromptsContext";
import type { PromptsStore } from "../features/prompts/types";
import { AppShell } from "./AppShell";

const bookmarks: BookmarksStore = {
  listBookmarks: async () => [],
  listFolders: async () => [],
  createBookmark: async () => undefined,
  updateBookmark: async () => undefined,
  deleteBookmark: async () => undefined,
  importBookmarks: async () => ({ importedCount: 0, updatedCount: 0, skippedCount: 0 }),
  searchBookmarks: async () => [],
  countExistingBookmarks: async () => 0,
};

const journal: JournalStore = {
  getEntry: async () => "",
  saveEntry: async () => undefined,
  listTodos: async () => [],
  createTodo: async () => "todo-1",
  updateTodoContent: async () => undefined,
  setTodoCompleted: async () => undefined,
  moveTodo: async () => undefined,
  reorderTodos: async () => undefined,
  deleteTodo: async () => undefined,
  searchJournal: async () => [],
};

const prompts: PromptsStore = {
  listPrompts: async () => [],
  createPrompt: async () => "prompt-1",
  updatePrompt: async () => undefined,
  deletePrompt: async () => undefined,
  searchPrompts: async () => [],
};

describe("AppShell", () => {
  it("renders the minimal navigation and changes pages", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BookmarksProvider repository={bookmarks}>
          <PromptsProvider repository={prompts}>
            <JournalProvider repository={journal}><AppShell /></JournalProvider>
          </PromptsProvider>
        </BookmarksProvider>
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", { name: "主导航" });
    expect(within(navigation).getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "书签" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "提示词" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "日记" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "设置" })).toBeInTheDocument();

    await user.click(within(navigation).getByRole("link", { name: "书签" }));
    expect(screen.getByRole("heading", { name: "书签" })).toBeInTheDocument();
  });

  it("opens global search with Command K", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BookmarksProvider repository={bookmarks}>
          <PromptsProvider repository={prompts}>
            <JournalProvider repository={journal}><AppShell /></JournalProvider>
          </PromptsProvider>
        </BookmarksProvider>
      </MemoryRouter>,
    );
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog", { name: "全局搜索" })).toBeInTheDocument();
  });

  it("focuses the current module quick add with Command N", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <BookmarksProvider repository={bookmarks}>
          <PromptsProvider repository={prompts}>
            <JournalProvider repository={journal}><AppShell /></JournalProvider>
          </PromptsProvider>
        </BookmarksProvider>
      </MemoryRouter>,
    );
    const todoInput = await screen.findByLabelText("新增 Todo");
    await user.keyboard("{Meta>}n{/Meta}");
    expect(todoInput).toHaveFocus();
  });
});
