import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookmarksProvider } from "./BookmarksContext";
import { BookmarksPage } from "./BookmarksPage";
import type { Bookmark, BookmarksStore } from "./types";

const savedBookmark: Bookmark = {
  id: "bookmark-1",
  url: "https://pytorch.org/docs",
  normalizedUrl: "https://pytorch.org/docs",
  title: "PyTorch 文档",
  description: "常用 API 参考",
  folderId: "folder-1",
  folderName: "研究资料",
  tags: ["深度学习", "文档"],
  createdAt: "2026-08-21T00:00:00.000Z",
  updatedAt: "2026-08-21T00:00:00.000Z",
};

function createStore(overrides: Partial<BookmarksStore> = {}): BookmarksStore {
  return {
    listBookmarks: vi.fn().mockResolvedValue([savedBookmark]),
    listFolders: vi.fn().mockResolvedValue([{ id: "folder-1", name: "研究资料", parentId: null }]),
    createBookmark: vi.fn().mockResolvedValue(undefined),
    updateBookmark: vi.fn().mockResolvedValue(undefined),
    deleteBookmark: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPage(repository: BookmarksStore) {
  return render(<BookmarksProvider repository={repository}><BookmarksPage /></BookmarksProvider>);
}

describe("BookmarksPage", () => {
  it("loads local bookmarks and filters across their metadata", async () => {
    const user = userEvent.setup();
    renderPage(createStore());

    expect(await screen.findByRole("heading", { name: "PyTorch 文档" })).toBeInTheDocument();
    expect(screen.getAllByText("研究资料")).toHaveLength(2);
    await user.type(screen.getByRole("searchbox", { name: "搜索书签" }), "不存在");
    expect(screen.getByRole("heading", { name: "没有符合条件的书签" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清除筛选" }));
    expect(screen.getByRole("heading", { name: "PyTorch 文档" })).toBeInTheDocument();
  });

  it("creates a bookmark from the editor", async () => {
    const user = userEvent.setup();
    const repository = createStore({ listBookmarks: vi.fn().mockResolvedValue([]) });
    renderPage(repository);

    await screen.findByRole("heading", { name: "这里还没有书签" });
    await user.click(screen.getByRole("button", { name: "添加书签" }));
    const dialog = screen.getByRole("dialog", { name: "添加书签" });
    await user.type(within(dialog).getByLabelText("网页地址"), "https://example.com/docs");
    await user.type(within(dialog).getByLabelText(/标题/), "Example Docs");
    await user.type(within(dialog).getByLabelText(/文件夹/), "文档");
    await user.type(within(dialog).getByLabelText(/标签/), "API, 参考");
    await user.click(within(dialog).getByRole("button", { name: "保存书签" }));

    await waitFor(() => expect(repository.createBookmark).toHaveBeenCalledWith({
      url: "https://example.com/docs",
      title: "Example Docs",
      description: "",
      folderName: "文档",
      tags: ["API", "参考"],
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a field-level error for unsupported URLs", async () => {
    const user = userEvent.setup();
    const repository = createStore();
    renderPage(repository);

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "添加书签" }));
    const dialog = screen.getByRole("dialog", { name: "添加书签" });
    await user.type(within(dialog).getByLabelText("网页地址"), "ftp://example.com");
    await user.click(within(dialog).getByRole("button", { name: "保存书签" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("只支持 http 或 https");
    expect(repository.createBookmark).not.toHaveBeenCalled();
  });

  it("edits and deletes an existing bookmark after confirmation", async () => {
    const user = userEvent.setup();
    const repository = createStore();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage(repository);

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "编辑 PyTorch 文档" }));
    const dialog = screen.getByRole("dialog", { name: "编辑书签" });
    const title = within(dialog).getByLabelText(/标题/);
    await user.clear(title);
    await user.type(title, "PyTorch API");
    await user.click(within(dialog).getByRole("button", { name: "保存书签" }));
    await waitFor(() => expect(repository.updateBookmark).toHaveBeenCalledWith(
      "bookmark-1",
      expect.objectContaining({ title: "PyTorch API" }),
    ));

    await user.click(screen.getByRole("button", { name: "删除 PyTorch 文档" }));
    expect(confirm).toHaveBeenCalledWith("删除书签“PyTorch 文档”？此操作无法撤销。");
    await waitFor(() => expect(repository.deleteBookmark).toHaveBeenCalledWith("bookmark-1"));
    confirm.mockRestore();
  });
});
