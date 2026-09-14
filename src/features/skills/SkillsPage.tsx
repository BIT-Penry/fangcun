import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import {
  ArrowLeft, Box, Check, ChevronRight, Clipboard, Download, FileArchive, FileCode2,
  FolderOpen, Image as ImageIcon, Link2, Plus, Search, Star, Tag, Upload, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessionState } from "../../shared/useSessionState";
import { generateSkillTags, getAiServiceConfig } from "../../shared/aiService";
import { buildSkillCollectionExport, buildSkillExport, type SkillExportArchive } from "./export";
import { parseSkillFile, parseSkillFrontmatter, parseSkillZipCollection } from "./import";
import { collectionSourceLabel, groupSkillsBySource, type SkillCollection } from "./library";
import { useSkillsStore } from "./SkillsContext";
import type { Skill, SkillInput } from "./types";
import { fetchGithubSkill } from "./github";

function resourceCount(skill: Skill, kind: "script" | "reference" | "asset"): number {
  return skill.resources.filter((resource) => resource.kind === kind).length;
}

async function suggestedTagMap(
  items: Array<Pick<SkillInput, "name" | "description" | "content">>,
  existingTags: string[],
): Promise<Map<number, string[]>> {
  const response = await generateSkillTags(items.map((item, index) => ({
    id: String(index),
    name: item.name,
    description: item.description,
    content: item.content.slice(0, 6_000),
  })), existingTags);
  const existingByName = new Map(existingTags.map((tag) => [tag.toLocaleLowerCase(), tag]));
  return new Map(response.skills.map((item) => [
    Number(item.id),
    item.tags.map((tag) => existingByName.get(tag.toLocaleLowerCase()) ?? tag),
  ]));
}

function skillInput(skill: Skill, tags: string[], description = skill.description): SkillInput {
  return {
    name: skill.name, description, content: skill.content, notes: skill.notes,
    sourceName: skill.sourceName, packageType: skill.packageType, packageData: skill.packageData,
    coverDataUrl: skill.coverDataUrl, isFavorite: skill.isFavorite, tags,
    compatibility: skill.compatibility, resources: skill.resources,
  };
}

function SkillCard({ skill, copied, onCopy, onExport, onOpen }: {
  skill: Skill;
  copied: boolean;
  onCopy: () => void;
  onExport: () => void;
  onOpen: () => void;
}) {
  return <article className="skill-card">
    <button type="button" className="skill-card-summary" onClick={onOpen} aria-label={`打开 ${skill.name} 详情`}>
      {skill.coverDataUrl
        ? <img className="skill-card-cover" src={skill.coverDataUrl} alt="" loading="lazy" decoding="async" />
        : <span className="skill-card-icon" aria-hidden="true"><FileCode2 size={19} /></span>}
      <span className="skill-card-copy">
        <span className="skill-card-title-row"><span className="skill-card-title">{skill.name}</span>{skill.isFavorite && <Star aria-label="已收藏" size={14} fill="currentColor" />}</span>
        <span className={skill.description ? "skill-card-description" : "skill-card-description muted"}>
          {skill.description || "暂未填写说明，可在详情页补充这个 Skill 的用途。"}
        </span>
      </span>
      <ChevronRight className="skill-card-summary-arrow" aria-hidden="true" size={16} />
    </button>
    <div className="skill-card-tags">
      {skill.compatibility.slice(0, 1).map((name) => <span className="skill-compatibility" key={name}>{name}</span>)}
      {skill.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
    </div>
    <div className="skill-card-resources" aria-label="资源统计">
      <span><FileCode2 aria-hidden="true" size={13} />{resourceCount(skill, "script")} 脚本</span>
      <span><FileArchive aria-hidden="true" size={13} />{resourceCount(skill, "reference")} 参考</span>
      <span><ImageIcon aria-hidden="true" size={13} />{resourceCount(skill, "asset")} 素材</span>
    </div>
    <div className="skill-card-actions">
      <button type="button" onClick={onCopy} aria-label={`复制 ${skill.name} 正文`}>
        {copied ? <Check aria-hidden="true" size={14} /> : <Clipboard aria-hidden="true" size={14} />}
        {copied ? "已复制" : "复制"}
      </button>
      <button type="button" onClick={onExport} aria-label={`导出 ${skill.name}`}><Download aria-hidden="true" size={14} />导出</button>
      <button type="button" className="skill-card-open" onClick={onOpen}>打开详情<ChevronRight aria-hidden="true" size={15} /></button>
    </div>
  </article>;
}

function CollectionCard({ collection, onOpen }: { collection: SkillCollection; onOpen: () => void }) {
  const resources = collection.skills.reduce((total, skill) => total + skill.resources.length, 0);
  return <article className="skill-collection-card">
    <button type="button" className="skill-collection-card-main" onClick={onOpen} aria-label={`打开合集 ${collection.name}`}>
      <span className="skill-collection-card-heading">
        <span className="skill-collection-icon" aria-hidden="true"><FolderOpen size={21} /></span>
        <span>
          <span className="skill-collection-title">{collection.name}</span>
          <span className="skill-collection-description">{collection.skills.length} 个 Skill，{resources} 项配套资源</span>
        </span>
        <ChevronRight aria-hidden="true" size={16} />
      </span>
      <span className="skill-collection-preview" aria-label="合集内容预览">
        {collection.skills.slice(0, 4).map((skill) => <span key={skill.id}>
          {skill.coverDataUrl ? <img src={skill.coverDataUrl} alt="" loading="lazy" decoding="async" /> : <FileCode2 aria-hidden="true" size={15} />}
          <small>{skill.name}</small>
        </span>)}
      </span>
    </button>
    <div className="skill-collection-card-footer">
      <span className="skill-collection-source">{collectionSourceLabel(collection.sourceName)}</span>
      <div className="skill-card-tags">{collection.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <button type="button" onClick={onOpen}>打开合集<ChevronRight aria-hidden="true" size={15} /></button>
    </div>
  </article>;
}

export function SkillsPage() {
  const repository = useSkillsStore();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useSessionState("fangcun:skills:search", "");
  const [tagFilter, setTagFilter] = useSessionState("fangcun:skills:tag", "");
  const [compatibilityFilter, setCompatibilityFilter] = useSessionState("fangcun:skills:compatibility", "");
  const [favoriteOnly, setFavoriteOnly] = useSessionState("fangcun:skills:favorites", false);
  const [selectedCollectionSource, setSelectedCollectionSource] = useSessionState("fangcun:skills:collection", "");
  const [githubImportOpen, setGithubImportOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [message, setMessage] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiBackfillAttempted = useRef(false);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setSkills(await repository.listSkills({ includePackageData: false }));
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("无法读取本地技能库，请重试");
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  useEffect(() => {
    if (status !== "idle" || aiBackfillAttempted.current) return;
    const candidates = skills.filter((skill) => (skill.tags.length === 0 || skill.tags.length > 2)
      && /^https:\/\/(www\.)?github\.com\//i.test(skill.sourceName));
    if (!candidates.length) return;
    aiBackfillAttempted.current = true;
    void (async () => {
      try {
        if (!(await getAiServiceConfig()).configured) {
          const overTagged = candidates.filter((skill) => skill.tags.length > 2);
          await Promise.all(overTagged.map(async (skill) => {
            const fullSkill = await repository.getSkill(skill.id);
            if (fullSkill) await repository.updateSkill(skill.id, skillInput(fullSkill, skill.tags.slice(0, 2)));
          }));
          if (overTagged.length) {
            setMessage(`已将 ${overTagged.length} 个 Skill 精简为最多 2 个标签`);
            await load();
          }
          return;
        }
        setMessage(`正在为 ${candidates.length} 个已导入 Skill 整理核心标签…`);
        const existingTags = [...new Set(skills.flatMap((skill) => skill.tags))];
        const suggestions = await suggestedTagMap(candidates, existingTags);
        await Promise.all(candidates.map(async (skill, index) => {
          const fullSkill = await repository.getSkill(skill.id);
          if (!fullSkill) return;
          const parsedDescription = parseSkillFrontmatter(fullSkill.content).description;
          await repository.updateSkill(fullSkill.id, skillInput(fullSkill, suggestions.get(index) ?? [], parsedDescription || fullSkill.description));
        }));
        setMessage(`已为 ${candidates.length} 个 Skill 整理为 1 至 2 个核心标签`);
        await load();
      } catch (error) {
        setMessage(`Skill 已保留，但 AI 标签生成失败：${error instanceof Error ? error.message : typeof error === "string" ? error : "请稍后重试"}`);
      }
    })();
  }, [load, repository, skills, status]);

  const startNew = useCallback(() => navigate("/skills/new"), [navigate]);
  useEffect(() => {
    window.addEventListener("fangcun:quick-add", startNew);
    return () => window.removeEventListener("fangcun:quick-add", startNew);
  }, [startNew]);

  const allTags = useMemo(() => [...new Set(skills.flatMap((skill) => skill.tags))]
    .sort((left, right) => left.localeCompare(right, "zh-CN")), [skills]);
  const allCompatibility = useMemo(() => [...new Set(skills.flatMap((skill) => skill.compatibility))]
    .sort((left, right) => left.localeCompare(right, "zh-CN")), [skills]);
  const groupedLibrary = useMemo(() => groupSkillsBySource(skills), [skills]);
  const selectedCollection = useMemo(() => groupedLibrary.collections
    .find((collection) => collection.sourceName === selectedCollectionSource) ?? null,
  [groupedLibrary.collections, selectedCollectionSource]);
  const filterSkill = useCallback((skill: Skill, includeSearch = true) => {
    const needle = search.trim().toLocaleLowerCase();
    const matchesSearch = !includeSearch || !needle || [skill.name, skill.description, skill.content, ...skill.tags]
      .some((value) => value.toLocaleLowerCase().includes(needle));
    return matchesSearch
      && (!tagFilter || skill.tags.includes(tagFilter))
      && (!compatibilityFilter || skill.compatibility.includes(compatibilityFilter))
      && (!favoriteOnly || skill.isFavorite);
  }, [compatibilityFilter, favoriteOnly, search, tagFilter]);
  const visibleCollections = useMemo(() => groupedLibrary.collections.flatMap((collection) => {
    const collectionMatchesSearch = search.trim() && [collection.name, collection.sourceName]
      .some((value) => value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    const memberSkills = collection.skills.filter((skill) => filterSkill(skill, !collectionMatchesSearch));
    return memberSkills.length ? [{ ...collection, skills: memberSkills }] : [];
  }), [filterSkill, groupedLibrary.collections, search]);
  const visibleSingles = useMemo(() => groupedLibrary.singles.filter((skill) => filterSkill(skill)),
    [filterSkill, groupedLibrary.singles]);
  const visibleSkills = useMemo(() => selectedCollection?.skills.filter((skill) => filterSkill(skill)) ?? [],
    [filterSkill, selectedCollection]);

  const importSkill = async () => {
    const source = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Agent Skill", extensions: ["md", "zip"] }],
    });
    if (!source || Array.isArray(source)) return;
    setStatus("idle");
    setMessage("正在导入 Skill…");
    try {
      const filename = source.split(/[\\/]/).pop() ?? "SKILL.md";
      const input = parseSkillFile(filename, await readFile(source));
      const id = await repository.createSkill(input);
      setMessage(`已导入“${input.name}”`);
      await load();
      navigate(`/skills/${id}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "导入 Skill 失败");
    }
  };

  const importGithubSkill = async () => {
    if (!githubUrl.trim() || githubLoading) return;
    const sourceUrl = githubUrl.trim();
    setStatus("idle");
    setGithubLoading(true); setMessage("正在从 GitHub 读取 Skill…");
    try {
      const source = await fetchGithubSkill(sourceUrl);
      const inputs = source.filename.toLocaleLowerCase().endsWith(".zip")
        ? parseSkillZipCollection(source.filename, source.data, source.preferredSkillPath)
        : [parseSkillFile(source.filename, source.data, source.preferredSkillPath)];
      let tagMessage = "";
      try {
        if ((await getAiServiceConfig()).configured) {
          setMessage(`检测到 ${inputs.length} 个 Skill，正在生成 AI 标签…`);
          const suggestions = await suggestedTagMap(inputs, allTags);
          inputs.forEach((input, index) => { input.tags = suggestions.get(index) ?? []; });
          tagMessage = "，并已生成 AI 推荐标签";
        } else {
          tagMessage = "；尚未配置 AI，未生成标签";
        }
      } catch (error) {
        tagMessage = `；AI 标签生成失败：${error instanceof Error ? error.message : typeof error === "string" ? error : "请稍后重试"}`;
      }
      setMessage(inputs.length > 1 ? `检测到 ${inputs.length} 个 Skill，正在导入…` : "正在创建 Skill…");
      const createdIds: string[] = [];
      try {
        for (const input of inputs) {
          input.sourceName = sourceUrl;
          createdIds.push(await repository.createSkill(input));
        }
      } catch (error) {
        await Promise.all(createdIds.map((id) => repository.deleteSkill(id)));
        throw error;
      }
      setGithubUrl(""); setGithubImportOpen(false);
      setMessage(inputs.length === 1 ? `已从 GitHub 导入“${inputs[0].name}”${tagMessage}` : `已从 GitHub 导入 ${inputs.length} 个 Skill${tagMessage}`);
      await load();
      if (inputs.length === 1) navigate(`/skills/${createdIds[0]}`);
      else setSelectedCollectionSource(sourceUrl);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : typeof error === "string" ? error : "GitHub Skill 导入失败");
    } finally { setGithubLoading(false); }
  };

  const copyContent = async (skill: Skill) => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    try {
      await navigator.clipboard.writeText(skill.content);
      setCopiedId(skill.id);
      copyTimer.current = setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setMessage("无法访问剪贴板，请打开详情后手动复制");
    }
  };

  const saveArchive = async (archive: SkillExportArchive, label: string, primaryNames: string[]) => {
    if (archive.missingDependencies.length && !window.confirm(
      `未找到依赖：${archive.missingDependencies.join("、")}。继续导出可能导致 Skill 不完整，是否继续？`,
    )) return;
    const target = await save({
      defaultPath: archive.filename,
      filters: [{ name: "Agent Skill", extensions: ["zip"] }],
    });
    if (!target) return;
    await writeFile(target, archive.data);
    const primary = new Set(primaryNames.map((name) => name.toLocaleLowerCase()));
    const dependencies = archive.includedSkillNames.filter((name) => !primary.has(name.toLocaleLowerCase()));
    setMessage(dependencies.length
      ? `已导出“${label}”，并自动包含依赖：${dependencies.join("、")}`
      : `已导出“${label}”`);
  };

  const exportSkill = async (skill: Skill) => {
    const library = await repository.listSkills({ includePackageData: true });
    const fullSkill = library.find((item) => item.id === skill.id) ?? skill;
    await saveArchive(buildSkillExport(fullSkill, library), skill.name, [skill.name]);
  };

  const exportCollection = async (collection: SkillCollection) => {
    const library = await repository.listSkills({ includePackageData: true });
    const collectionIds = new Set(collection.skills.map((skill) => skill.id));
    const fullCollection = library.filter((skill) => collectionIds.has(skill.id));
    await saveArchive(
      buildSkillCollectionExport(collection.name, fullCollection, library),
      collection.name,
      collection.skills.map((skill) => skill.name),
    );
  };

  const filtering = Boolean(search || tagFilter || compatibilityFilter || favoriteOnly);
  const totalVisible = selectedCollection ? visibleSkills.length : visibleCollections.length + visibleSingles.length;
  const mixedLibrary = !selectedCollection && visibleCollections.length > 0 && visibleSingles.length > 0;
  const resultLabel = selectedCollection
    ? `${visibleSkills.length} 个 Skill`
    : mixedLibrary
      ? `${visibleCollections.length} 个合集，${visibleSingles.length} 个独立 Skill`
      : visibleCollections.length > 0
        ? `${visibleCollections.length} 个合集`
        : `${visibleSingles.length} 个 Skill`;

  return (
    <section className="skills-page">
      <header className="bookmarks-header">
        <div>
          <h1>技能库</h1>
          <p className="page-description">收录可复用的 Agent Skill，连同说明与资源一起保存。</p>
        </div>
        <div className="bookmark-header-actions">
          <button type="button" className="button-secondary" onClick={() => setGithubImportOpen((value) => !value)}>
            <Link2 aria-hidden="true" size={16} />链接导入
          </button>
          <button type="button" className="button-secondary" onClick={() => void importSkill()}>
            <Upload aria-hidden="true" size={16} />导入文件
          </button>
          <button type="button" className="button-primary" onClick={startNew}>
            <Plus aria-hidden="true" size={17} />新建 Skill
          </button>
        </div>
      </header>

      {githubImportOpen && <form className="skill-github-import" onSubmit={(event) => { event.preventDefault(); void importGithubSkill(); }}>
        <Link2 aria-hidden="true" size={16} />
        <label><span className="sr-only">GitHub Skill 链接</span><input autoFocus type="url" value={githubUrl} placeholder="粘贴 GitHub 仓库、目录或 SKILL.md 链接" onChange={(event) => setGithubUrl(event.target.value)} /></label>
        <button type="submit" className="button-primary" disabled={!githubUrl.trim() || githubLoading}>{githubLoading ? "正在读取" : "读取并导入"}</button>
        <button type="button" className="icon-button" aria-label="关闭链接导入" onClick={() => { setGithubImportOpen(false); setGithubUrl(""); }}><X aria-hidden="true" size={16} /></button>
      </form>}

      <div className="skill-library-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={16} />
          <span className="sr-only">搜索技能库</span>
          <input type="search" value={search} placeholder="搜索名称、说明、正文或标签"
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="filter-field">
          <Tag aria-hidden="true" size={15} /><span className="sr-only">按标签筛选</span>
          <select aria-label="按 Skill 标签筛选" value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="">全部标签</option>
            {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <Box aria-hidden="true" size={15} /><span className="sr-only">按兼容平台筛选</span>
          <select aria-label="按兼容平台筛选" value={compatibilityFilter} onChange={(event) => setCompatibilityFilter(event.target.value)}>
            <option value="">全部平台</option>
            {allCompatibility.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button type="button" className={favoriteOnly ? "filter-toggle active" : "filter-toggle"}
          aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly((value) => !value)}>
          <Star aria-hidden="true" size={14} />收藏
        </button>
      </div>

      {selectedCollection && <div className="skill-collection-detail-heading">
        <button type="button" onClick={() => setSelectedCollectionSource("")}><ArrowLeft aria-hidden="true" size={15} />全部技能</button>
        <span className="skill-collection-icon" aria-hidden="true"><FolderOpen size={21} /></span>
        <div>
          <h2>{selectedCollection.name}</h2>
          <p>{selectedCollection.skills.length} 个 Skill，来自 {collectionSourceLabel(selectedCollection.sourceName)}</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => void exportCollection(selectedCollection)}>
          <Download aria-hidden="true" size={15} />导出合集
        </button>
      </div>}

      <div className="skill-result-meta">
        <span>{resultLabel}</span>
        {filtering && <button type="button" onClick={() => {
          setSearch(""); setTagFilter(""); setCompatibilityFilter(""); setFavoriteOnly(false);
        }}>清除筛选</button>}
      </div>
      {message && <p className={status === "error" ? "inline-error" : "skill-inline-message"} role={status === "error" ? "alert" : "status"}>{message}</p>}

      {status === "loading" && <div className="skill-card-grid" aria-label="正在读取技能库">
        {[0, 1, 2].map((item) => <div key={item} className="skill-card skill-card-skeleton" />)}
      </div>}
      {status !== "loading" && totalVisible === 0 && <div className="skill-empty-state">
        <FileCode2 aria-hidden="true" size={26} />
        <h2>{filtering ? "没有符合条件的 Skill" : "技能库还是空的"}</h2>
        <p>{filtering ? "调整关键词或清除筛选后再试。" : "导入 SKILL.md 或 ZIP 技能包，也可以从空白内容开始。"}</p>
        {!filtering && <div><button type="button" className="button-secondary" onClick={() => void importSkill()}><Upload aria-hidden="true" size={15} />导入 Skill</button><button type="button" className="button-primary" onClick={startNew}><Plus aria-hidden="true" size={15} />新建 Skill</button></div>}
      </div>}
      {status !== "loading" && totalVisible > 0 && selectedCollection && <div className="skill-card-grid">
        {visibleSkills.map((skill) => <SkillCard key={skill.id} skill={skill} copied={copiedId === skill.id}
          onCopy={() => void copyContent(skill)} onExport={() => void exportSkill(skill)}
          onOpen={() => navigate(`/skills/${skill.id}`)} />)}
      </div>}
      {status !== "loading" && totalVisible > 0 && !selectedCollection && <div className="skill-library-sections">
        {visibleCollections.length > 0 && <section>
          {mixedLibrary && <header className="skill-library-section-title"><h2>技能合集</h2><span>同一来源的 Skill 已自动收纳</span></header>}
          <div className="skill-collection-grid">
            {visibleCollections.map((collection) => <CollectionCard key={collection.sourceName} collection={collection}
              onOpen={() => setSelectedCollectionSource(collection.sourceName)} />)}
          </div>
        </section>}
        {visibleSingles.length > 0 && <section>
          {mixedLibrary && <header className="skill-library-section-title"><h2>独立 Skill</h2><span>自己创建或单独导入</span></header>}
          <div className="skill-card-grid">
            {visibleSingles.map((skill) => <SkillCard key={skill.id} skill={skill} copied={copiedId === skill.id}
              onCopy={() => void copyContent(skill)} onExport={() => void exportSkill(skill)}
              onOpen={() => navigate(`/skills/${skill.id}`)} />)}
          </div>
        </section>}
      </div>}
    </section>
  );
}
