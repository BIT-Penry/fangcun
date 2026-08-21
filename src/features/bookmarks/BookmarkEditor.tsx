import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Bookmark, BookmarkFolder, BookmarkInput } from "./types";
import { normalizeBookmarkUrl } from "./url";

function initialInput(bookmark: Bookmark | null): BookmarkInput {
  return {
    url: bookmark?.url ?? "",
    title: bookmark?.title ?? "",
    description: bookmark?.description ?? "",
    folderName: bookmark?.folderName ?? "",
    tags: bookmark?.tags ?? [],
  };
}

export function BookmarkEditor({ bookmark, folders, onClose, onSave }: {
  bookmark: Bookmark | null;
  folders: BookmarkFolder[];
  onClose: () => void;
  onSave: (input: BookmarkInput) => Promise<void>;
}) {
  const [input, setInput] = useState(() => initialInput(bookmark));
  const [tagsText, setTagsText] = useState(() => input.tags.join(", "));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
          <label className="field-label">
            网页地址
            <input autoFocus required type="url" value={input.url} placeholder="https://example.com"
              onChange={(event) => setInput({ ...input, url: event.target.value })} />
          </label>
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
