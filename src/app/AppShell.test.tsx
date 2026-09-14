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
import { BrowserPreferenceProvider } from "./browser/BrowserPreferenceProvider";
import { SkillsProvider } from "../features/skills/SkillsContext";
import type { SkillsStore } from "../features/skills/types";

const bookmarks: BookmarksStore = {
  listBookmarks: async () => [],
  listFolders: async () => [],
  createBookmark: async () => undefined,
  createFolder: async () => "folder-new",
  renameFolder: async () => undefined,
  updateBookmark: async () => undefined,
  updateBookmarkMetadata: async () => undefined,
  deleteBookmark: async () => undefined,
  deleteFolder: async () => undefined,
  moveBookmark: async () => undefined,
  moveFolder: async () => undefined,
  importBookmarks: async () => ({ importedCount: 0, updatedCount: 0, skippedCount: 0, enrichmentTargets: [] }),
  searchBookmarks: async () => [],
  countExistingBookmarks: async () => 0,
};

const journal: JournalStore = {
  getEntry: async () => "",
  getEntryMood: async () => null,
  saveEntry: async () => undefined,
  setEntryMood: async () => undefined,
  listTodos: async () => [],
  createTodo: async () => "todo-1",
  updateTodoContent: async () => undefined,
  updateTodoDetails: async () => undefined,
  setTodoCompleted: async () => undefined,
  moveTodo: async () => undefined,
  reorderTodos: async () => undefined,
  deleteTodo: async () => undefined,
  getMonthSummary: async () => ({
    entryDays: 0, todoCount: 0, completedTodoCount: 0,
    p1TodoCount: 0, p2TodoCount: 0, p3TodoCount: 0,
  }),
  getOpenTodoCounts: async () => ({}),
  searchJournal: async () => [],
};

const prompts: PromptsStore = {
  listPrompts: async () => [],
  createPrompt: async () => "prompt-1",
  updatePrompt: async () => undefined,
  deletePrompt: async () => undefined,
  searchPrompts: async () => [],
};

const skills: SkillsStore = {
  listSkills: async () => [],
  getSkill: async () => null,
  createSkill: async () => "skill-1",
  updateSkill: async () => undefined,
  deleteSkill: async () => undefined,
  searchSkills: async () => [],
};

describe("AppShell", () => {
  it("renders the minimal navigation and changes pages", async () => {
    const user = userEvent.setup();
    render(
      <BrowserPreferenceProvider>
        <MemoryRouter initialEntries={["/"]}>
          <BookmarksProvider repository={bookmarks}>
            <PromptsProvider repository={prompts}>
              <SkillsProvider repository={skills}><JournalProvider repository={journal}><AppShell /></JournalProvider></SkillsProvider>
            </PromptsProvider>
          </BookmarksProvider>
        </MemoryRouter>
      </BrowserPreferenceProvider>,
    );

    const navigation = screen.getByRole("navigation", { name: "主导航" });
    expect(within(navigation).getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "书签" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "提示词" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "技能库" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "工具箱" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "日记" })).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "设置" })).toBeInTheDocument();

    await user.click(within(navigation).getByRole("link", { name: "书签" }));
    expect(screen.getByRole("heading", { name: "书签" })).toBeInTheDocument();
  });

  it("opens global search with Command K", async () => {
    const user = userEvent.setup();
    render(
      <BrowserPreferenceProvider>
        <MemoryRouter initialEntries={["/"]}>
          <BookmarksProvider repository={bookmarks}>
            <PromptsProvider repository={prompts}>
              <SkillsProvider repository={skills}><JournalProvider repository={journal}><AppShell /></JournalProvider></SkillsProvider>
            </PromptsProvider>
          </BookmarksProvider>
        </MemoryRouter>
      </BrowserPreferenceProvider>,
    );
    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog", { name: "全局搜索" })).toBeInTheDocument();
  });

  it("lets people collapse and expand the sidebar", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BrowserPreferenceProvider>
        <MemoryRouter initialEntries={["/"]}>
          <BookmarksProvider repository={bookmarks}>
            <PromptsProvider repository={prompts}>
              <SkillsProvider repository={skills}><JournalProvider repository={journal}><AppShell /></JournalProvider></SkillsProvider>
            </PromptsProvider>
          </BookmarksProvider>
        </MemoryRouter>
      </BrowserPreferenceProvider>,
    );

    await user.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(container.querySelector(".app-shell")).toHaveClass("sidebar-collapsed");
    await user.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(container.querySelector(".app-shell")).not.toHaveClass("sidebar-collapsed");
  });

  it("focuses the current module quick add with Command N", async () => {
    const user = userEvent.setup();
    render(
      <BrowserPreferenceProvider>
        <MemoryRouter initialEntries={["/"]}>
          <BookmarksProvider repository={bookmarks}>
            <PromptsProvider repository={prompts}>
              <SkillsProvider repository={skills}><JournalProvider repository={journal}><AppShell /></JournalProvider></SkillsProvider>
            </PromptsProvider>
          </BookmarksProvider>
        </MemoryRouter>
      </BrowserPreferenceProvider>,
    );
    const quickAddBookmark = await screen.findByRole("button", { name: "书签" });
    await user.keyboard("{Meta>}n{/Meta}");
    expect(quickAddBookmark).toHaveFocus();
  });
});
