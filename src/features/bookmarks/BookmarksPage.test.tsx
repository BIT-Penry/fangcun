import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { BookmarksProvider } from "./BookmarksContext";
import { BookmarksPage } from "./BookmarksPage";
import type { Bookmark, BookmarksStore } from "./types";
import { BrowserPreferenceProvider } from "../../app/browser/BrowserPreferenceProvider";
import { openExternalUrl } from "../../shared/openExternal";
import { fetchImportBookmarkMetadata } from "./metadata";

vi.mock("./metadata", () => ({
  fetchBookmarkMetadata: vi.fn().mockResolvedValue({ title: null, description: null, faviconUrl: null, aiEnhanced: false, warning: null }),
  fetchAiBookmarkMetadata: vi.fn().mockResolvedValue({ title: null, description: null, faviconUrl: null, aiEnhanced: false, warning: null }),
  fetchImportBookmarkMetadata: vi.fn().mockResolvedValue({ title: null, description: null, faviconUrl: null, aiEnhanced: false, warning: null }),
}));
vi.mock("../../shared/openExternal", () => ({ openExternalUrl: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn().mockResolvedValue("/tmp/fangcun-bookmarks.html") }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn().mockResolvedValue(undefined) }));

const savedBookmark: Bookmark = {
  id: "bookmark-1",
  url: "https://pytorch.org/docs",
  normalizedUrl: "https://pytorch.org/docs",
  title: "PyTorch 文档",
  description: "常用 API 参考",
  faviconUrl: "https://pytorch.org/favicon.ico",
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
    updateBookmarkMetadata: vi.fn().mockResolvedValue(undefined),
    deleteBookmark: vi.fn().mockResolvedValue(undefined),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    moveBookmark: vi.fn().mockResolvedValue(undefined),
    moveFolder: vi.fn().mockResolvedValue(undefined),
    importBookmarks: vi.fn().mockResolvedValue({ importedCount: 0, updatedCount: 0, skippedCount: 0, enrichmentTargets: [] }),
    searchBookmarks: vi.fn().mockResolvedValue([]),
    countExistingBookmarks: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function renderPage(repository: BookmarksStore, browser: "system" | "chrome" = "system", route = "/bookmarks") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BrowserPreferenceProvider initialPreference={browser}>
        <BookmarksProvider repository={repository}><BookmarksPage /></BookmarksProvider>
      </BrowserPreferenceProvider>
    </MemoryRouter>,
  );
}

describe("BookmarksPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the exact bookmark selected from the homepage", async () => {
    renderPage(createStore(), "system", "/bookmarks?edit=bookmark-1");

    const dialog = await screen.findByRole("dialog", { name: "编辑书签" });
    expect(within(dialog).getByLabelText(/标题/)).toHaveValue("PyTorch 文档");
  });

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

  it("sorts bookmark cards while keeping recently updated as the default", async () => {
    const user = userEvent.setup();
    const older: Bookmark = {
      ...savedBookmark,
      id: "bookmark-older",
      title: "Alpha 文档",
      url: "https://alpha.example.com",
      normalizedUrl: "https://alpha.example.com/",
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    };
    const newer: Bookmark = {
      ...savedBookmark,
      id: "bookmark-newer",
      title: "Zeta 文档",
      url: "https://zeta.example.com",
      normalizedUrl: "https://zeta.example.com/",
      createdAt: "2026-08-22T00:00:00.000Z",
      updatedAt: "2026-08-23T00:00:00.000Z",
    };
    renderPage(createStore({ listBookmarks: vi.fn().mockResolvedValue([older, newer]) }));

    await screen.findByRole("heading", { name: "Zeta 文档" });
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent))
      .toEqual(["Zeta 文档", "Alpha 文档"]);

    await user.selectOptions(screen.getByLabelText("卡片排序"), "title-asc");
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent))
      .toEqual(["Alpha 文档", "Zeta 文档"]);
  });

  it("renders large bookmark libraries progressively", async () => {
    const user = userEvent.setup();
    const bookmarks = Array.from({ length: 60 }, (_, index): Bookmark => ({
      ...savedBookmark,
      id: `bookmark-${index}`,
      title: `资料 ${String(index).padStart(2, "0")}`,
      url: `https://example.com/${index}`,
      normalizedUrl: `https://example.com/${index}`,
    }));
    renderPage(createStore({ listBookmarks: vi.fn().mockResolvedValue(bookmarks) }));

    await screen.findByRole("heading", { name: "资料 00" });
    expect(document.querySelectorAll(".bookmark-card")).toHaveLength(48);
    const more = screen.getByRole("button", { name: /继续显示/ });
    expect(more).toHaveTextContent("还有 12 条");
    await user.click(more);
    expect(document.querySelectorAll(".bookmark-card")).toHaveLength(60);
    expect(screen.queryByRole("button", { name: /继续显示/ })).not.toBeInTheDocument();
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
    await user.type(within(dialog).getByLabelText("新建文件夹路径"), "文档");
    await user.type(within(dialog).getByLabelText("搜索或新建书签标签"), "API{Enter}参考{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "保存书签" }));

    await waitFor(() => expect(repository.createBookmark).toHaveBeenCalledWith({
      url: "https://example.com/docs",
      title: "Example Docs",
      description: "",
      faviconUrl: "",
      folderName: "文档",
      tags: ["API", "参考"],
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens in the selected browser and copies a bookmark link", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderPage(createStore(), "chrome");

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "打开 PyTorch 文档" }));
    expect(openExternalUrl).toHaveBeenCalledWith("https://pytorch.org/docs", "chrome");
    await user.click(screen.getByRole("button", { name: "复制 PyTorch 文档 的链接" }));
    expect(writeText).toHaveBeenCalledWith("https://pytorch.org/docs");
    expect(screen.getByRole("button", { name: "复制 PyTorch 文档 的链接" })).toHaveTextContent("已复制");
  });

  it("exports the complete bookmark library as browser-compatible HTML", async () => {
    const user = userEvent.setup();
    renderPage(createStore());

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "导出 HTML" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: expect.stringMatching(/^fangcun-bookmarks-\d{8}\.html$/),
      filters: [{ name: "浏览器书签", extensions: ["html"] }],
    })));
    expect(writeTextFile).toHaveBeenCalledWith(
      "/tmp/fangcun-bookmarks.html",
      expect.stringContaining("<!DOCTYPE NETSCAPE-Bookmark-file-1>"),
    );
    expect(screen.getByText("已导出 1 条书签")).toBeInTheDocument();
  });

  it("shows nested bookmarks in the folder view", async () => {
    const user = userEvent.setup();
    const nestedBookmark = { ...savedBookmark, folderId: "folder-papers", folderName: "论文" };
    renderPage(createStore({
      listBookmarks: vi.fn().mockResolvedValue([nestedBookmark]),
      listFolders: vi.fn().mockResolvedValue([
        { id: "folder-research", name: "研究", parentId: null },
        { id: "folder-papers", name: "论文", parentId: "folder-research" },
      ]),
    }));

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "文件夹视图" }));
    const expandResearch = screen.getByRole("button", { name: "展开文件夹 研究" });
    expect(expandResearch).toHaveAttribute("aria-expanded", "false");
    await user.click(expandResearch);
    expect(screen.getByRole("button", { name: "收起文件夹 研究" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "查看文件夹 论文" }));
    expect(screen.getByRole("heading", { name: "研究 / 论文" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开书签 PyTorch 文档" })).toBeInTheDocument();
    expect(document.querySelector(".bookmark-card")).not.toBeInTheDocument();
  });

  it("deletes an empty folder from the folder browser", async () => {
    const user = userEvent.setup();
    const repository = createStore({
      listFolders: vi.fn().mockResolvedValue([
        { id: "folder-1", name: "研究资料", parentId: null },
        { id: "folder-empty", name: "空目录", parentId: null },
      ]),
    });
    renderPage(repository);

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "文件夹视图" }));
    await user.click(screen.getByRole("button", { name: "查看文件夹 空目录" }));
    await user.click(screen.getByRole("button", { name: "删除文件夹 空目录" }));

    const dialog = screen.getByRole("dialog", { name: "删除文件夹？" });
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "删除文件夹" }));
    await waitFor(() => expect(repository.deleteFolder).toHaveBeenCalledWith("folder-empty"));
  });

  it("requires a checkbox before deleting a folder containing bookmarks or child folders", async () => {
    const user = userEvent.setup();
    const repository = createStore({
      listFolders: vi.fn().mockResolvedValue([
        { id: "folder-1", name: "研究资料", parentId: null },
        { id: "folder-child", name: "论文", parentId: "folder-1" },
      ]),
    });
    renderPage(repository);

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "文件夹视图" }));
    await user.click(screen.getByRole("button", { name: "查看文件夹 研究资料" }));
    await user.click(screen.getByRole("button", { name: "删除文件夹 研究资料" }));

    const dialog = screen.getByRole("dialog", { name: "删除文件夹？" });
    expect(within(dialog).getByRole("note")).toHaveTextContent("1 个子文件夹");
    expect(within(dialog).getByRole("note")).toHaveTextContent("1 条书签");
    const deleteButton = within(dialog).getByRole("button", { name: "删除全部内容" });
    expect(deleteButton).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "我确认删除这个文件夹及其中全部内容" }));
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);
    await waitFor(() => expect(repository.deleteFolder).toHaveBeenCalledWith("folder-1"));
  });

  it("moves a bookmark by dragging it onto another folder", async () => {
    const user = userEvent.setup();
    const repository = createStore({
      listFolders: vi.fn().mockResolvedValue([
        { id: "folder-1", name: "研究资料", parentId: null },
        { id: "folder-target", name: "归档", parentId: null },
      ]),
    });
    renderPage(repository);

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    await user.click(screen.getByRole("button", { name: "文件夹视图" }));
    await user.click(screen.getByRole("button", { name: "查看文件夹 研究资料" }));
    const source = screen.getByLabelText("拖动书签 PyTorch 文档");
    const target = screen.getByRole("button", { name: "查看文件夹 归档" });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn().mockReturnValue(target) });

    fireEvent.pointerDown(source, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(source, { pointerId: 1, clientX: 20, clientY: 0 });
    fireEvent.pointerUp(source, { pointerId: 1, clientX: 20, clientY: 0 });

    await waitFor(() => expect(repository.moveBookmark).toHaveBeenCalledWith("bookmark-1", "folder-target"));
  });

  it("changes folder hierarchy by dragging one folder onto another", async () => {
    const repository = createStore({
      listFolders: vi.fn().mockResolvedValue([
        { id: "folder-1", name: "研究资料", parentId: null },
        { id: "folder-target", name: "归档", parentId: null },
      ]),
    });
    renderPage(repository);

    await screen.findByRole("heading", { name: "PyTorch 文档" });
    fireEvent.click(screen.getByRole("button", { name: "文件夹视图" }));
    const source = screen.getByRole("button", { name: "查看文件夹 归档" });
    const target = screen.getByRole("button", { name: "查看文件夹 研究资料" });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: vi.fn().mockReturnValue(target) });

    fireEvent.pointerDown(source, { button: 0, pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(source, { pointerId: 2, clientX: 20, clientY: 0 });
    fireEvent.pointerUp(source, { pointerId: 2, clientX: 20, clientY: 0 });

    await waitFor(() => expect(repository.moveFolder).toHaveBeenCalledWith("folder-target", "folder-1"));
  });

  it("explains automatic cleanup and hides duplicate choices when the library has no match", async () => {
    const user = userEvent.setup();
    const repository = createStore({ listBookmarks: vi.fn().mockResolvedValue([]) });
    renderPage(repository);
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
      <DT><H3>研究</H3><DL><p>
        <DT><A HREF="https://example.com/docs">Example</A>
        <DT><A HREF="https://example.com/docs#section">Duplicate</A>
        <DT><A HREF="javascript:alert(1)">Invalid</A>
      </DL></DL>`;

    await user.upload(screen.getByLabelText("选择 Bookmark HTML 文件"), new File([html], "bookmarks.html", { type: "text/html" }));

    const dialog = await screen.findByRole("dialog", { name: "导入检查" });
    expect(within(dialog).getByText("1 条文件内重复将自动去重")).toBeInTheDocument();
    expect(within(dialog).getByText("1 条无效地址将自动跳过")).toBeInTheDocument();
    expect(within(dialog).queryByRole("group", { name: "如何处理资料库中已有的网址？" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "导入 1 条书签" })).toBeEnabled();
  });

  it("only offers a duplicate strategy when imported URLs already exist", async () => {
    const user = userEvent.setup();
    const repository = createStore({
      listBookmarks: vi.fn().mockResolvedValue([]),
      countExistingBookmarks: vi.fn().mockResolvedValue(1),
    });
    renderPage(repository);
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://example.com/docs">Example</A></DL>`;

    await user.upload(screen.getByLabelText("选择 Bookmark HTML 文件"), new File([html], "bookmarks.html", { type: "text/html" }));

    const dialog = await screen.findByRole("dialog", { name: "导入检查" });
    expect(within(dialog).getByRole("group", { name: "如何处理资料库中已有的网址？" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/保留现有书签/)).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "没有可导入的书签" })).toBeDisabled();

    await user.click(within(dialog).getByLabelText(/补全缺失信息/));
    expect(within(dialog).getByRole("button", { name: "补全 1 条已有书签" })).toBeEnabled();
  });

  it("keeps imported titles while filling descriptions and favicons in the background", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchImportBookmarkMetadata).mockResolvedValueOnce({
      title: null,
      description: "AI 生成的页面用途简介。",
      faviconUrl: "https://example.com/favicon.ico",
      aiEnhanced: true,
      warning: null,
    });
    const repository = createStore({
      listBookmarks: vi.fn().mockResolvedValue([]),
      importBookmarks: vi.fn().mockResolvedValue({
        importedCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        enrichmentTargets: [{ id: "imported-1", url: "https://example.com/docs" }],
      }),
    });
    renderPage(repository);
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://example.com/docs">HTML 原标题</A></DL>`;

    await user.upload(screen.getByLabelText("选择 Bookmark HTML 文件"), new File([html], "bookmarks.html", { type: "text/html" }));
    const dialog = await screen.findByRole("dialog", { name: "导入检查" });
    expect(within(dialog).getByLabelText(/导入后补全卡片资料/)).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "导入 1 条书签" }));

    await waitFor(() => expect(repository.updateBookmarkMetadata).toHaveBeenCalledWith(
      "imported-1",
      "AI 生成的页面用途简介。",
      "https://example.com/favicon.ico",
    ));
    expect(repository.updateBookmark).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("标题保留 HTML 原文");
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
