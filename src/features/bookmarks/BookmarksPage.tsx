import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Folder, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { BookmarkEditor } from "./BookmarkEditor";
import { useBookmarksStore } from "./BookmarksContext";
import type { Bookmark, BookmarkFolder, BookmarkInput } from "./types";
import { bookmarkHostname } from "./url";

export function BookmarksPage() {
  const repository = useBookmarksStore();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [editor, setEditor] = useState<Bookmark | "new" | null>(null);

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

  const filtering = Boolean(search || folderFilter || tagFilter);

  return (
    <section className="bookmarks-page">
      <header className="bookmarks-header">
        <div>
          <p className="eyebrow">LOCAL LIBRARY</p>
          <h1>书签</h1>
          <p className="page-description">把常用资料放在一个安静、可检索的空间里。</p>
        </div>
        <button type="button" className="button-primary" onClick={() => setEditor("new")}>
          <Plus aria-hidden="true" size={17} />
          添加书签
        </button>
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
        <div className="bookmark-list">
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
                <a href={bookmark.url} target="_blank" rel="noreferrer" className="icon-button" aria-label={`打开 ${bookmark.title}`}>
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
    </section>
  );
}
