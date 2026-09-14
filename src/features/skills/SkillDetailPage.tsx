import { useCallback, useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import {
  ArrowLeft, Check, Clipboard, Download, FileArchive, FileCode2, Image as ImageIcon,
  Save, Sparkles, Star, Trash2, Upload, WandSparkles, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate, useParams } from "react-router-dom";
import { openExternalUrl } from "../../shared/openExternal";
import { buildSkillExport } from "./export";
import { skillMarkdownBody } from "./import";
import { useSkillsStore } from "./SkillsContext";
import type { Skill, SkillInput, SkillResourceSummary } from "./types";
import { formatSkillContent, generateSkillDescription } from "../../shared/aiService";

const COMPATIBILITY_OPTIONS = ["Codex", "Claude Code", "OpenAI Agents", "通用 Markdown"];

const EMPTY_INPUT: SkillInput = {
  name: "", description: "", content: "---\nname: new-skill\ndescription: \"\"\n---\n\n# 使用说明\n\n",
  notes: "", sourceName: "SKILL.md", packageType: "markdown", packageData: null,
  coverDataUrl: null, isFavorite: false, tags: [], compatibility: [], resources: [],
};

function toInput(skill: Skill): SkillInput {
  return {
    name: skill.name, description: skill.description, content: skill.content, notes: skill.notes,
    sourceName: skill.sourceName, packageType: skill.packageType, packageData: skill.packageData,
    coverDataUrl: skill.coverDataUrl, isFavorite: skill.isFavorite, tags: skill.tags,
    compatibility: skill.compatibility, resources: skill.resources,
  };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function countResources(resources: SkillResourceSummary[], kind: SkillResourceSummary["kind"]): number {
  return resources.filter((resource) => resource.kind === kind).length;
}

export function SkillDetailPage() {
  const { skillId } = useParams();
  const isNew = skillId === "new";
  const repository = useSkillsStore();
  const navigate = useNavigate();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [draft, setDraft] = useState<SkillInput>(EMPTY_INPUT);
  const [mode, setMode] = useState<"preview" | "edit">(isNew ? "edit" : "preview");
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">(isNew ? "idle" : "loading");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiAction, setAiAction] = useState<"idle" | "formatting" | "describing">("idle");
  const [formatPreview, setFormatPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew || !skillId) return;
    setStatus("loading");
    try {
      const next = await repository.getSkill(skillId);
      if (!next) {
        setStatus("error"); setMessage("这个 Skill 不存在或已经被删除"); return;
      }
      setSkill(next); setDraft(toInput(next)); setStatus("idle");
    } catch {
      setStatus("error"); setMessage("无法读取这个 Skill，请重试");
    }
  }, [isNew, repository, skillId]);

  useEffect(() => { void load(); }, [load]);

  const tagText = draft.tags.join(", ");
  const changeTags = (value: string) => setDraft((current) => ({
    ...current,
    tags: [...new Set(value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))].slice(0, 2),
  }));

  const saveSkill = async () => {
    setStatus("saving"); setMessage("");
    try {
      if (isNew) {
        const id = await repository.createSkill(draft);
        setStatus("saved");
        setMode("preview");
        navigate(`/skills/${id}`, { replace: true });
        return;
      }
      if (!skillId) return;
      await repository.updateSkill(skillId, draft);
      setStatus("saved"); setMessage("更改已保存"); setMode("preview"); await load();
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "保存 Skill 失败");
    }
  };

  const deleteSkill = async () => {
    if (!skillId || isNew || !window.confirm(`删除 Skill“${draft.name || "未命名 Skill"}”？此操作无法撤销。`)) return;
    await repository.deleteSkill(skillId);
    navigate("/skills", { replace: true });
  };

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(draft.content);
      setCopied(true); window.setTimeout(() => setCopied(false), 1500);
    } catch { setMessage("无法访问剪贴板"); }
  };

  const exportSkill = async () => {
    const current: Skill = skill ?? {
      id: "new", ...draft, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const library = await repository.listSkills({ includePackageData: true });
    const archive = buildSkillExport({ ...current, ...draft }, library);
    if (archive.missingDependencies.length && !window.confirm(
      `未找到依赖：${archive.missingDependencies.join("、")}。继续导出可能导致 Skill 不完整，是否继续？`,
    )) return;
    const target = await save({ defaultPath: archive.filename, filters: [{ name: "Agent Skill", extensions: ["zip"] }] });
    if (!target) return;
    await writeFile(target, archive.data);
    const dependencies = archive.includedSkillNames.filter((name) => name.toLocaleLowerCase() !== draft.name.toLocaleLowerCase());
    setMessage(dependencies.length
      ? `已导出 ${archive.filename}，并自动包含依赖：${dependencies.join("、")}`
      : `已导出 ${archive.filename}`);
  };

  const chooseCover = async () => {
    const source = await open({ multiple: false, directory: false, filters: [{ name: "封面图片", extensions: ["png", "jpg", "jpeg", "webp"] }] });
    if (!source || Array.isArray(source)) return;
    const extension = source.split(".").pop()?.toLocaleLowerCase();
    const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    const coverDataUrl = bytesToDataUrl(await readFile(source), mime);
    setDraft((current) => ({ ...current, coverDataUrl }));
  };

  const createDescription = async () => {
    if (!draft.content.trim() || aiAction !== "idle") return;
    setStatus("idle"); setAiAction("describing"); setMessage("正在生成一句话简介…");
    try {
      const result = await generateSkillDescription(draft.name, draft.content);
      setDraft((current) => ({ ...current, description: result.description }));
      setMessage("已生成简介，请确认后保存");
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "AI 简介生成失败");
    } finally { setAiAction("idle"); }
  };

  const formatContent = async () => {
    if (!draft.content.trim() || aiAction !== "idle") return;
    const source = draft.content;
    setStatus("idle"); setAiAction("formatting"); setFormatPreview(null); setMessage("正在校正 SKILL.md 格式…");
    try {
      const result = await formatSkillContent(source);
      if (result.content === source) {
        setMessage("当前格式已经很整齐，无需调整");
      } else {
        setFormatPreview(result.content); setMessage("已生成格式预览，确认后才会替换正文");
      }
    } catch (error) {
      setStatus("error"); setMessage(error instanceof Error ? error.message : "AI 格式校正失败");
    } finally { setAiAction("idle"); }
  };

  const resourceGroups = useMemo(() => [
    { kind: "script" as const, label: "脚本", icon: FileCode2 },
    { kind: "reference" as const, label: "参考资料", icon: FileArchive },
    { kind: "asset" as const, label: "素材", icon: ImageIcon },
  ], []);
  const previewContent = useMemo(() => skillMarkdownBody(draft.content), [draft.content]);

  if (status === "loading") return <section className="skill-detail-page"><p className="compact-empty">正在读取 Skill…</p></section>;

  return (
    <section className="skill-detail-page">
      <header className="skill-detail-header">
        <button type="button" className="skill-back-button" onClick={() => navigate("/skills")}><ArrowLeft aria-hidden="true" size={17} />返回技能库</button>
        <div className="skill-detail-actions">
          {!isNew && <button type="button" className="button-secondary" onClick={() => void copyContent()}>{copied ? <Check aria-hidden="true" size={15} /> : <Clipboard aria-hidden="true" size={15} />}{copied ? "已复制" : "复制正文"}</button>}
          {!isNew && <button type="button" className="button-secondary" onClick={() => void exportSkill()}><Download aria-hidden="true" size={15} />导出 Skill</button>}
          {mode === "preview" ? <button type="button" className="button-primary" onClick={() => setMode("edit")}>编辑 Skill</button>
            : <><button type="button" className="button-secondary" onClick={() => { setDraft(skill ? toInput(skill) : EMPTY_INPUT); setMode(isNew ? "edit" : "preview"); }}>{isNew ? "重置" : "取消编辑"}</button><button type="button" className="button-primary" disabled={status === "saving"} onClick={() => void saveSkill()}><Save aria-hidden="true" size={15} />{status === "saving" ? "正在保存" : isNew ? "创建 Skill" : "保存更改"}</button></>}
        </div>
      </header>
      {message && <p className={status === "error" ? "inline-error" : "skill-inline-message"} role={status === "error" ? "alert" : "status"}>{message}</p>}

      {mode === "preview" ? <div className="skill-detail-layout">
        <main className="skill-document">
          <div className="skill-document-title">
            <div>
              <h1>{draft.name}</h1>
              <p>{draft.description || "暂未填写说明"}</p>
            </div>
            {draft.isFavorite && <Star aria-label="已收藏" size={17} fill="currentColor" />}
          </div>
          <div className="skill-markdown markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
              a: ({ href, children }) => <a href={href} onClick={(event) => { event.preventDefault(); if (href) void openExternalUrl(href); }}>{children}</a>,
            }}>{previewContent}</ReactMarkdown>
          </div>
        </main>
        <aside className="skill-detail-sidebar">
          {draft.coverDataUrl && <img className="skill-detail-cover" src={draft.coverDataUrl} alt={`${draft.name} 封面`} />}
          <section><h2>分类与兼容</h2><div className="skill-detail-chips">{draft.compatibility.map((item) => <span className="skill-compatibility" key={item}>{item}</span>)}{draft.tags.map((tag) => <span key={tag}>{tag}</span>)}{draft.compatibility.length + draft.tags.length === 0 && <small>尚未设置</small>}</div></section>
          <section><h2>包含资源</h2><div className="skill-resource-summary">{resourceGroups.map(({ kind, label, icon: Icon }) => <div key={kind}><Icon aria-hidden="true" size={15} /><span>{label}</span><strong>{countResources(draft.resources, kind)}</strong></div>)}</div></section>
          <section><h2>来源</h2><p>{draft.sourceName || "手动创建"}</p><small>脚本仅保存和展示，不会在方寸中执行。</small></section>
          {draft.notes && <section><h2>使用备注</h2><p>{draft.notes}</p></section>}
          <button type="button" className="skill-delete-button" onClick={() => void deleteSkill()}><Trash2 aria-hidden="true" size={14} />删除 Skill</button>
        </aside>
      </div> : <div className="skill-editor-layout">
        <main className="skill-editor-main">
          <label className="form-field"><span>名称</span><input value={draft.name} placeholder="例如：论文精读" onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="form-field"><span className="skill-field-heading"><span>简介</span><button type="button" onClick={(event) => { event.preventDefault(); void createDescription(); }} disabled={!draft.content.trim() || aiAction !== "idle"}><Sparkles aria-hidden="true" size={13} />{aiAction === "describing" ? "正在生成" : "AI 生成简介"}</button></span><textarea rows={3} value={draft.description} placeholder="用一句话说明这个 Skill 解决什么问题" onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></label>
          <label className="form-field skill-content-field"><span className="skill-field-heading"><span>SKILL.md</span><button type="button" onClick={(event) => { event.preventDefault(); void formatContent(); }} disabled={!draft.content.trim() || aiAction !== "idle"}><WandSparkles aria-hidden="true" size={13} />{aiAction === "formatting" ? "正在校正" : "AI 校正格式"}</button></span><textarea value={draft.content} spellCheck={false} onChange={(event) => { setFormatPreview(null); setDraft((current) => ({ ...current, content: event.target.value })); }} />{formatPreview && <div className="skill-format-preview"><span><strong>格式校正预览</strong><small>原正文尚未改变</small></span><pre>{formatPreview}</pre><span><button type="button" className="button-secondary" onClick={(event) => { event.preventDefault(); setFormatPreview(null); }}>保留原文</button><button type="button" className="button-primary" onClick={(event) => { event.preventDefault(); setDraft((current) => ({ ...current, content: formatPreview })); setFormatPreview(null); setMessage("已应用格式校正，请保存更改"); }}>应用校正</button></span></div>}</label>
        </main>
        <aside className="skill-editor-sidebar">
          <section><h2>封面</h2>{draft.coverDataUrl ? <div className="skill-cover-editor"><img src={draft.coverDataUrl} alt="Skill 封面预览" /><button type="button" className="icon-button" aria-label="移除封面" onClick={() => setDraft((current) => ({ ...current, coverDataUrl: null }))}><X aria-hidden="true" size={15} /></button></div> : <button type="button" className="skill-cover-picker" onClick={() => void chooseCover()}><Upload aria-hidden="true" size={16} />选择小封面<span>可选，建议使用简洁横图</span></button>}</section>
          <section><h2>兼容平台</h2><div className="skill-compatibility-options">{COMPATIBILITY_OPTIONS.map((name) => <label key={name}><input type="checkbox" checked={draft.compatibility.includes(name)} onChange={() => setDraft((current) => ({ ...current, compatibility: current.compatibility.includes(name) ? current.compatibility.filter((item) => item !== name) : [...current.compatibility, name] }))} /><span>{name}</span></label>)}</div></section>
          <label className="form-field"><span>标签</span><input value={tagText} placeholder="研究, 写作" onChange={(event) => changeTags(event.target.value)} /><small>建议保留 1 至 2 个核心标签，使用逗号分隔</small></label>
          <label className="form-field"><span>使用备注</span><textarea rows={5} value={draft.notes} placeholder="记录适用场景或注意事项" onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
          <label className="skill-favorite-toggle"><input type="checkbox" checked={draft.isFavorite} onChange={(event) => setDraft((current) => ({ ...current, isFavorite: event.target.checked }))} /><Star aria-hidden="true" size={15} /><span>收藏这个 Skill</span></label>
        </aside>
      </div>}
    </section>
  );
}
