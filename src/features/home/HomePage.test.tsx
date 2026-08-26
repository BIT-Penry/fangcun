import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BookmarksProvider } from "../bookmarks/BookmarksContext";
import type { Bookmark, BookmarksStore } from "../bookmarks/types";
import { JournalProvider } from "../journal/JournalContext";
import type { JournalStore, Todo } from "../journal/types";
import { PromptsProvider } from "../prompts/PromptsContext";
import type { Prompt, PromptsStore } from "../prompts/types";
import { HomePage } from "./HomePage";

const bookmark: Bookmark = {
  id: "bookmark-1",
  url: "https://pytorch.org/docs",
  normalizedUrl: "https://pytorch.org/docs",
  title: "PyTorch 文档",
  description: "常用 API 参考",
  faviconUrl: null,
  folderId: null,
  folderName: null,
  tags: ["研究"],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
};

const prompt: Prompt = {
  id: "prompt-1",
  title: "论文摘要",
  content: "Summarize the following paper.",
  notes: "",
  isFavorite: true,
  tags: [],
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
};

const todo: Todo = {
  id: "todo-1",
  date: "2026-08-23",
  content: "整理实验结果",
  isCompleted: false,
  sortOrder: 0,
  dueTime: "18:30",
  priority: "high",
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
};

function createBookmarksStore(): BookmarksStore {
  return {
    listBookmarks: vi.fn().mockResolvedValue([bookmark]),
    listFolders: vi.fn().mockResolvedValue([]),
    createBookmark: vi.fn().mockResolvedValue(undefined),
    updateBookmark: vi.fn().mockResolvedValue(undefined),
    updateBookmarkMetadata: vi.fn().mockResolvedValue(undefined),
    deleteBookmark: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    moveBookmark: vi.fn().mockResolvedValue(undefined),
    moveFolder: vi.fn().mockResolvedValue(undefined),
    importBookmarks: vi.fn().mockResolvedValue({ importedCount: 0, updatedCount: 0, skippedCount: 0, enrichmentTargets: [] }),
    searchBookmarks: vi.fn().mockResolvedValue([]),
    countExistingBookmarks: vi.fn().mockResolvedValue(0),
  };
}

function createPromptsStore(): PromptsStore {
  return {
    listPrompts: vi.fn().mockResolvedValue([prompt]),
    createPrompt: vi.fn().mockResolvedValue("prompt-new"),
    updatePrompt: vi.fn().mockResolvedValue(undefined),
    deletePrompt: vi.fn().mockResolvedValue(undefined),
    searchPrompts: vi.fn().mockResolvedValue([]),
  };
}

function createJournalStore(entry = "记录今天的模型实验结果。"): JournalStore {
  return {
    getEntry: vi.fn().mockResolvedValue(entry),
    getEntryMood: vi.fn().mockResolvedValue("😊"),
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
    getMonthSummary: vi.fn().mockResolvedValue({
      entryDays: 0, todoCount: 0, completedTodoCount: 0,
      p1TodoCount: 0, p2TodoCount: 0, p3TodoCount: 0,
    }),
    getOpenTodoCounts: vi.fn().mockResolvedValue({}),
    searchJournal: vi.fn().mockResolvedValue([]),
  };
}

function renderHome(entry?: string) {
  const bookmarks = createBookmarksStore();
  const prompts = createPromptsStore();
  const journal = createJournalStore(entry);
  render(
    <MemoryRouter>
      <BookmarksProvider repository={bookmarks}>
        <PromptsProvider repository={prompts}>
          <JournalProvider repository={journal}><HomePage /></JournalProvider>
        </PromptsProvider>
      </BookmarksProvider>
    </MemoryRouter>,
  );
  return { bookmarks, prompts, journal };
}

describe("HomePage", () => {
  it("shows recent material, today's focus, inbox counts, and journal excerpt", async () => {
    renderHome();

    expect(await screen.findByText("论文摘要")).toBeInTheDocument();
    expect(screen.getByText("PyTorch 文档")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /论文摘要/ })).toHaveAttribute("href", "/prompts?open=prompt-1");
    expect(screen.getByRole("link", { name: /PyTorch 文档/ })).toHaveAttribute("href", "/bookmarks?edit=bookmark-1");
    expect(screen.getByText("整理实验结果")).toBeInTheDocument();
    expect(screen.getByText("1 条未归档书签")).toBeInTheDocument();
    expect(screen.getByText("1 条未标记提示词")).toBeInTheDocument();
    expect(screen.getByText("记录今天的模型实验结果。")).toBeInTheDocument();
  });

  it("renders the journal excerpt as Markdown instead of source text", async () => {
    renderHome("> **入职完毕！** 初至深圳，希望一切顺利！");

    const preview = await screen.findByLabelText("今日一笔 Markdown 预览");
    expect(preview).toHaveTextContent("入职完毕！ 初至深圳，希望一切顺利！");
    expect(preview).not.toHaveTextContent(">");
    expect(preview.querySelector("blockquote strong")).toHaveTextContent("入职完毕！");
  });

  it("completes a focus task and opens global search", async () => {
    const user = userEvent.setup();
    const { journal } = renderHome();
    const openSearch = vi.fn();
    window.addEventListener("fangcun:open-search", openSearch);

    await user.click(await screen.findByRole("button", { name: "完成 整理实验结果" }));
    await waitFor(() => expect(journal.setTodoCompleted).toHaveBeenCalledWith("todo-1", true));
    expect(screen.queryByText("整理实验结果")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /搜索书签、提示词和日记/ }));
    expect(openSearch).toHaveBeenCalledOnce();
    window.removeEventListener("fangcun:open-search", openSearch);
  });
});
