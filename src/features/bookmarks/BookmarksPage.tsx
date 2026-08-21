import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Folder, Grid2X2, List, Pencil, Plus, Search, Tag, Trash2, Upload, X } from "lucide-react";
import { BookmarkEditor } from "./BookmarkEditor";
import { parseBookmarkHtml } from "./import";
import { useBookmarksStore } from "./BookmarksContext";
import type { Bookmark, BookmarkFolder, BookmarkImportPreview, BookmarkImportStrategy, BookmarkInput } from "./types";
import { bookmarkHostname } from "./url";
import { openExternalUrl } from "../../shared/openExternal";
import { useSessionState } from "../../shared/useSessionState";

export function BookmarksPage() {
  const repository = useBookmarksStore();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useSessionState("fangcun:bookmarks:search", "");
  const [folderFilter, setFolderFilter] = useSessionState("fangcun:bookmarks:folder", "");
  const [tagFilter, setTagFilter] = useSessionState("fangcun:bookmarks:tag", "");
  const [editor, setEditor] = useState<Bookmark | "new" | null>(null);
  const [view, setView] = useSessionState<"list" | "grid">("fangcun:bookmarks:view", "list");
  const [importPreview, setImportPreview] = useState<BookmarkImportPreview | null>(null);
  const [importStrategy, setImportStrategy] = useState<BookmarkImportStrategy>("skip");
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [nextBookmarks, nextFolders] = await Promise.all([
        repository.listBookmarks(),
        repository.listFolders(),
      ]);
      setBookmarks(nextBookmarks);
      setFolders(nextFolders);
    } catch {
      setLoadError("无法读取本地书签，请重试");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const openEditor = () => setEditor("new");
    window.addEventListener("fangcun:quick-add", openEditor);
    return () => window.removeEventListener("fangcun:quick-add", openEditor);
  }, []);

  const tags = useMemo(
    () => [...new Set(bookmarks.flatMap((bookmark) => bookmark.tags))]
      .sort((a, b) => a.localeCompare(b, "zh-CN")),
    [bookmarks],
  );

  const visibleBookmarks = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return bookmarks.filter((bookmark) => {
      const matchesSearch = !needle || [
        bookmark.title,
        bookmark.description,
        bookmark.url,
        bookmark.folderName ?? "",
        ...bookmark.tags,
      ].some((value) => value.toLocaleLowerCase().includes(needle));
      const matchesFolder = !folderFilter || bookmark.folderId === folderFilter;
      const matchesTag = !tagFilter || bookmark.tags.includes(tagFilter);
      return matchesSearch && matchesFolder && matchesTag;
    });
  }, [bookmarks, folderFilter, search, tagFilter]);

  const saveBookmark = async (input: BookmarkInput) => {
    if (editor !== "new" && editor) await repository.updateBookmark(editor.id, input);
    else await repository.createBookmark(input);
    await load();
    setEditor(null);
  };

  const deleteBookmark = async (bookmark: Bookmark) => {
    if (!window.confirm(`删除书签“${bookmark.title}”？此操作无法撤销。`)) return;
    try {
      await repository.deleteBookmark(bookmark.id);
      await load();
    } catch {
      setLoadError("删除书签失败，请重试");
    }
  };

  const chooseImportFile = async (file: File | undefined) => {
    if (!file) return;
    setLoadError("");
    setImportNotice("");
    try {
      const preview = parseBookmarkHtml(await file.text());
      const existingCount = await repository.countExistingBookmarks(
        preview.bookmarks.map((bookmark) => bookmark.normalizedUrl),
      );
      setImportPreview({ ...preview, existingCount });
      setImportStrategy("skip");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法解析 Bookmark HTML 文件");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };

  const importBookmarks = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const result = await repository.importBookmarks(importPreview.bookmarks, importStrategy);
      setImportNotice(`已导入 ${result.importedCount} 条，更新 ${result.updatedCount} 条，跳过 ${result.skippedCount} 条`);
      setImportPreview(null);
      await load();
    } catch {
      setLoadError("导入失败，未完整写入的内容已撤销，请重试");
    } finally {
      setImporting(false);
    }
  };

  const filtering = Boolean(search || folderFilter || tagFilter);

  return (
    <section className="bookmarks-page">
      <header className="bookmarks-header">
        <div>
          <p className="eyebrow">LOCAL LIBRARY</p>
          <h1>书签</h1>
          <p className="page-description">把常用资料放在一个安静、可检索的空间里。</p>
        </div>
        <div className="bookmark-header-actions">
          <input ref={importInput} className="sr-only" type="file" accept=".html,text/html"
            aria-label="选择 Bookmark HTML 文件" onChange={(event) => void chooseImportFile(event.target.files?.[0])} />
          <button type="button" className="button-secondary" onClick={() => importInput.current?.click()}>
            <Upload aria-hidden="true" size={16} />导入 HTML
          </button>
          <button type="button" className="button-primary" onClick={() => setEditor("new")}>
            <Plus aria-hidden="true" size={17} />添加书签
          </button>
        </div>
      </header>

      <div className="bookmark-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">搜索书签</span>
          <input type="search" value={search} placeholder="搜索标题、网址、简介或标签"
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="filter-field">
          <Folder aria-hidden="true" size={16} />
          <span className="sr-only">按文件夹筛选</span>
          <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}>
            <option value="">全部文件夹</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <Tag aria-hidden="true" size={16} />
          <span className="sr-only">按标签筛选</span>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="">全部标签</option>
            {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <div className="view-toggle" aria-label="书签视图">
          <button type="button" className={view === "list" ? "active" : ""} aria-label="列表视图" aria-pressed={view === "list"} onClick={() => setView("list")}><List aria-hidden="true" size={15} /></button>
          <button type="button" className={view === "grid" ? "active" : ""} aria-label="卡片视图" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 aria-hidden="true" size={15} /></button>
        </div>
      </div>

      <div className="bookmark-result-meta">
        <span>{visibleBookmarks.length} 条资料</span>
        {filtering && (
          <button type="button" onClick={() => { setSearch(""); setFolderFilter(""); setTagFilter(""); }}>
            清除筛选
          </button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="inline-error">
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()}>重试</button>
        </div>
      )}
      {importNotice && <div role="status" className="import-notice">{importNotice}</div>}

      {loading ? (
        <p className="bookmark-status">正在整理书签…</p>
      ) : visibleBookmarks.length === 0 ? (
        <div className="bookmark-empty">
          <div className="bookmark-empty-mark">⌁</div>
          <h2>{filtering ? "没有符合条件的书签" : "这里还没有书签"}</h2>
          <p>{filtering ? "换个关键词或清除筛选试试。" : "保存第一条常用网址，开始建立你的资料索引。"}</p>
          {!filtering && <button type="button" className="button-secondary" onClick={() => setEditor("new")}>添加第一条书签</button>}
        </div>
      ) : (
        <div className={view === "grid" ? "bookmark-list grid-view" : "bookmark-list"}>
          {visibleBookmarks.map((bookmark) => (
            <article key={bookmark.id} className="bookmark-card">
              {bookmark.faviconUrl && (
                <img className="bookmark-favicon" src={bookmark.faviconUrl} alt=""
                  onError={(event) => { event.currentTarget.style.display = "none"; }} />
              )}
              <div className="bookmark-card-main">
                <div className="bookmark-domain">{bookmarkHostname(bookmark.url)}</div>
                <h2>{bookmark.title}</h2>
                {bookmark.description && <p>{bookmark.description}</p>}
                <div className="bookmark-card-meta">
                  {bookmark.folderName && <span><Folder aria-hidden="true" size={13} />{bookmark.folderName}</span>}
                  {bookmark.tags.map((tag) => <span key={tag} className="bookmark-tag">{tag}</span>)}
                </div>
              </div>
              <div className="bookmark-card-actions">
                <a href={bookmark.url} className="icon-button" aria-label={`打开 ${bookmark.title}`}
                  onClick={(event) => {
                    event.preventDefault();
                    void openExternalUrl(bookmark.url).catch(() => setLoadError("无法使用默认浏览器打开这个网址"));
                  }}>
                  <ExternalLink aria-hidden="true" size={17} />
                </a>
                <button type="button" className="icon-button" onClick={() => setEditor(bookmark)} aria-label={`编辑 ${bookmark.title}`}>
                  <Pencil aria-hidden="true" size={16} />
                </button>
                <button type="button" className="icon-button danger" onClick={() => void deleteBookmark(bookmark)} aria-label={`删除 ${bookmark.title}`}>
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <BookmarkEditor key={editor === "new" ? "new" : editor.id}
          bookmark={editor === "new" ? null : editor}
          folders={folders}
          onClose={() => setEditor(null)}
          onSave={saveBookmark} />
      )}

      {importPreview && (
        <div className="dialog-backdrop">
          <section role="dialog" aria-modal="true" aria-labelledby="bookmark-import-title" className="bookmark-editor import-dialog">
            <header className="bookmark-editor-header">
              <div><p className="eyebrow">BOOKMARK IMPORT</p><h2 id="bookmark-import-title">确认导入</h2></div>
              <button type="button" className="icon-button" onClick={() => setImportPreview(null)} disabled={importing} aria-label="关闭"><X aria-hidden="true" size={18} /></button>
            </header>
            <div className="import-preview">
              <div className="import-stats">
                <span><strong>{importPreview.bookmarks.length}</strong> 条有效书签</span>
                <span><strong>{importPreview.folderPaths.length}</strong> 个文件夹</span>
                <span><strong>{importPreview.existingCount}</strong> 条资料库重复</span>
                <span><strong>{importPreview.duplicateInFileCount}</strong> 条文件内重复</span>
                <span><strong>{importPreview.invalidCount}</strong> 条无效地址</span>
              </div>
              <fieldset>
                <legend>遇到资料库中已有的网址</legend>
                <label><input type="radio" name="import-strategy" checked={importStrategy === "skip"} onChange={() => setImportStrategy("skip")} />跳过重复项</label>
                <label><input type="radio" name="import-strategy" checked={importStrategy === "fill"} onChange={() => setImportStrategy("fill")} />用导入内容补全缺失标题和文件夹</label>
              </fieldset>
              <p>导入只读取 HTML 中的链接与文件夹，不执行脚本，也不会加载其中的远程资源。</p>
              <footer className="bookmark-editor-actions">
                <button type="button" className="button-secondary" onClick={() => setImportPreview(null)} disabled={importing}>取消</button>
                <button type="button" className="button-primary" onClick={() => void importBookmarks()} disabled={importing || importPreview.bookmarks.length === 0}>{importing ? "导入中…" : "开始导入"}</button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
