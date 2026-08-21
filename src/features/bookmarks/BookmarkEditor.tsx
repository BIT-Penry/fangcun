import { useRef, useState, type FormEvent } from "react";
import { RefreshCw, X } from "lucide-react";
import { fetchBookmarkMetadata, type BookmarkMetadata } from "./metadata";
import type { Bookmark, BookmarkFolder, BookmarkInput } from "./types";
import { normalizeBookmarkUrl } from "./url";

function initialInput(bookmark: Bookmark | null): BookmarkInput {
  return {
    url: bookmark?.url ?? "",
    title: bookmark?.title ?? "",
    description: bookmark?.description ?? "",
    faviconUrl: bookmark?.faviconUrl ?? "",
    folderName: bookmark?.folderName ?? "",
    tags: bookmark?.tags ?? [],
  };
}

export function BookmarkEditor({
  bookmark,
  folders,
  onClose,
  onSave,
  metadataLoader = fetchBookmarkMetadata,
}: {
  bookmark: Bookmark | null;
  folders: BookmarkFolder[];
  onClose: () => void;
  onSave: (input: BookmarkInput) => Promise<void>;
  metadataLoader?: (url: string) => Promise<BookmarkMetadata>;
}) {
  const [input, setInput] = useState(() => initialInput(bookmark));
  const [tagsText, setTagsText] = useState(() => input.tags.join(", "));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [metadataStatus, setMetadataStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const lastFetchedUrl = useRef(bookmark?.normalizedUrl ?? "");

  const loadMetadata = async (force = false) => {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeBookmarkUrl(input.url);
    } catch {
      if (force) setMetadataStatus("error");
      return;
    }
    if (!force && normalizedUrl === lastFetchedUrl.current) return;

    lastFetchedUrl.current = normalizedUrl;
    setMetadataStatus("loading");
    try {
      const metadata = await metadataLoader(normalizedUrl);
      setInput((current) => {
        try {
          if (normalizeBookmarkUrl(current.url) !== normalizedUrl) return current;
        } catch {
          return current;
        }
        return {
          ...current,
          title: current.title.trim() || metadata.title || "",
          description: current.description.trim() || metadata.description || "",
          faviconUrl: metadata.faviconUrl || "",
        };
      });
      setMetadataStatus(metadata.title || metadata.description || metadata.faviconUrl ? "success" : "error");
    } catch {
      setMetadataStatus("error");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      normalizeBookmarkUrl(input.url);
      setSaving(true);
      await onSave({
        ...input,
        tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
    } catch (saveError) {
      setError(saveError instanceof Error
        ? saveError.message
        : "保存失败，请重试");
      setSaving(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <section role="dialog" aria-modal="true" aria-labelledby="bookmark-editor-title" className="bookmark-editor">
        <header className="bookmark-editor-header">
          <div>
            <p className="eyebrow">{bookmark ? "编辑资料" : "保存到方寸"}</p>
            <h2 id="bookmark-editor-title">{bookmark ? "编辑书签" : "添加书签"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="关闭">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <form onSubmit={(event) => void submit(event)} className="bookmark-form">
          <div className="field-label">
            <div className="field-label-row">
              <label htmlFor="bookmark-url">网页地址</label>
              <button type="button" className="metadata-button"
                onClick={() => void loadMetadata(true)} disabled={saving || metadataStatus === "loading" || !input.url.trim()}>
                <RefreshCw aria-hidden="true" size={12} className={metadataStatus === "loading" ? "spinning" : ""} />
                {metadataStatus === "loading" ? "获取中" : "获取网页信息"}
              </button>
            </div>
            <input id="bookmark-url" autoFocus required type="url" value={input.url} placeholder="https://example.com"
              onBlur={() => void loadMetadata()}
              onChange={(event) => {
                setInput({ ...input, url: event.target.value, faviconUrl: "" });
                setMetadataStatus("idle");
              }} />
            {metadataStatus === "success" && <span className="metadata-hint">已获取网页信息，可继续手动修改</span>}
            {metadataStatus === "error" && <span className="metadata-hint warning">未能获取网页信息，仍可手动填写并保存</span>}
          </div>
          <label className="field-label">
            标题 <span>可留空</span>
            <input value={input.title} placeholder="留空时使用网站域名"
              onChange={(event) => setInput({ ...input, title: event.target.value })} />
          </label>
          <label className="field-label">
            简介
            <textarea rows={3} value={input.description} placeholder="这条资料为什么值得保留？"
              onChange={(event) => setInput({ ...input, description: event.target.value })} />
          </label>

          <div className="bookmark-form-grid">
            <label className="field-label">
              文件夹 <span>可新建</span>
              <input list="bookmark-folder-options" value={input.folderName} placeholder="例如：论文"
                onChange={(event) => setInput({ ...input, folderName: event.target.value })} />
              <datalist id="bookmark-folder-options">
                {folders.map((folder) => <option key={folder.id} value={folder.name} />)}
              </datalist>
            </label>
            <label className="field-label">
              标签 <span>逗号分隔</span>
              <input value={tagsText} placeholder="研究, 工具"
                onChange={(event) => setTagsText(event.target.value)} />
            </label>
          </div>

          {error && <p role="alert" className="form-error">{error}</p>}

          <footer className="bookmark-editor-actions">
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>取消</button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? "保存中…" : "保存书签"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
