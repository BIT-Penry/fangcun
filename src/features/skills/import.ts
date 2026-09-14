import { strFromU8, unzipSync, zipSync } from "fflate";
import type { SkillInput, SkillResourceKind, SkillResourceSummary } from "./types";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
export const DEFAULT_IMPORTED_SKILL_COMPATIBILITY = ["通用 Markdown"];

function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillFrontmatter(markdown: string): { name: string; description: string } {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return { name: "", description: "" };
  }
  const lines = normalized.split(/\r?\n/);
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return { name: "", description: "" };
  const fields = new Map<string, string>();
  const frontmatterLines = lines.slice(1, end);
  for (let index = 0; index < frontmatterLines.length; index += 1) {
    const line = frontmatterLines[index];
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLocaleLowerCase();
    const rawValue = match[2].trim();
    if (/^[>|][+-]?$/.test(rawValue)) {
      const parts: string[] = [];
      while (index + 1 < frontmatterLines.length && !/^[A-Za-z][\w-]*:\s*/.test(frontmatterLines[index + 1])) {
        index += 1;
        const value = frontmatterLines[index].trim();
        if (value) parts.push(value);
      }
      fields.set(key, parts.join(rawValue.startsWith(">") ? " " : "\n"));
    } else {
      fields.set(key, unquote(rawValue));
    }
  }
  return {
    name: fields.get("name") ?? "",
    description: fields.get("description") ?? "",
  };
}

export function skillMarkdownBody(markdown: string): string {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) return markdown;
  const lines = normalized.split(/\r?\n/);
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return markdown;
  return lines.slice(end + 1).join("\n").replace(/^\s*\n/, "");
}

function titleFromFilename(filename: string): string {
  return filename.split(/[\\/]/).pop()?.replace(/\.md$/i, "").replace(/[-_]+/g, " ").trim() || "未命名 Skill";
}

function kindForPath(path: string): SkillResourceKind {
  const normalized = path.toLocaleLowerCase();
  if (normalized.includes("/scripts/") || normalized.startsWith("scripts/")) return "script";
  if (normalized.includes("/references/") || normalized.startsWith("references/")) return "reference";
  if (normalized.includes("/assets/") || normalized.startsWith("assets/")) return "asset";
  return "other";
}

function mimeForPath(path: string): string | null {
  const extension = path.split(".").pop()?.toLocaleLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return null;
}

function toDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function baseInput(filename: string, content: string): SkillInput {
  const metadata = parseSkillFrontmatter(content);
  return {
    name: metadata.name || titleFromFilename(filename),
    description: metadata.description,
    content,
    notes: "",
    sourceName: filename,
    packageType: "markdown",
    packageData: null,
    coverDataUrl: null,
    isFavorite: false,
    tags: [],
    compatibility: [...DEFAULT_IMPORTED_SKILL_COMPATIBILITY],
    resources: [],
  };
}

export function parseSkillMarkdown(filename: string, bytes: Uint8Array): SkillInput {
  const content = strFromU8(bytes);
  if (!content.trim()) throw new Error("Skill Markdown 文件是空的");
  return { ...baseInput(filename, content), packageData: bytes };
}

export function parseSkillZip(filename: string, bytes: Uint8Array, preferredSkillPath?: string | null): SkillInput {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Skill 压缩包不是有效的 ZIP 文件");
  }
  const paths = Object.keys(files).filter((path) => !path.endsWith("/") && !path.startsWith("__MACOSX/"));
  const preferredSuffix = preferredSkillPath ? `/${preferredSkillPath.replace(/^\/+/, "")}`.toLocaleLowerCase() : "";
  const skillPath = (preferredSuffix
    ? paths.find((path) => `/${path}`.toLocaleLowerCase().endsWith(preferredSuffix))
    : undefined) ?? paths
    .filter((path) => /(^|\/)SKILL\.md$/i.test(path))
    .sort((left, right) => left.split("/").length - right.split("/").length)[0];
  if (!skillPath) throw new Error("压缩包中没有找到 SKILL.md");
  const root = skillPath.slice(0, -"SKILL.md".length);
  const resources: SkillResourceSummary[] = paths
    .filter((path) => path !== skillPath && path.startsWith(root))
    .map((path) => ({ path: path.slice(root.length), kind: kindForPath(path.slice(root.length)), size: files[path].byteLength }))
    .sort((left, right) => left.path.localeCompare(right.path, "zh-CN"));
  const coverPath = paths.find((path) => {
    const relative = path.slice(root.length);
    const extension = relative.split(".").pop()?.toLocaleLowerCase() ?? "";
    return relative.startsWith("assets/") && IMAGE_EXTENSIONS.has(extension) && /(^|\/)(cover|preview|thumbnail)[.-_]/i.test(relative);
  }) ?? paths.find((path) => {
    const relative = path.slice(root.length);
    const extension = relative.split(".").pop()?.toLocaleLowerCase() ?? "";
    return relative.startsWith("assets/") && IMAGE_EXTENSIONS.has(extension);
  });
  const content = strFromU8(files[skillPath]);
  if (!content.trim()) throw new Error("压缩包中的 SKILL.md 是空的");
  const input = baseInput(filename, content);
  return {
    ...input,
    packageType: "zip",
    packageData: bytes,
    resources,
    coverDataUrl: coverPath && mimeForPath(coverPath) ? toDataUrl(files[coverPath], mimeForPath(coverPath) as string) : null,
  };
}

function packageSkillFromArchive(
  filename: string,
  files: Record<string, Uint8Array>,
  paths: string[],
  skillPath: string,
): SkillInput {
  const root = skillPath.slice(0, -"SKILL.md".length);
  const packageFiles = Object.fromEntries(
    paths
      .filter((path) => path.startsWith(root))
      .map((path) => [path.slice(root.length), files[path]]),
  );
  return parseSkillZip(filename, zipSync(packageFiles), "SKILL.md");
}

export function parseSkillZipCollection(
  filename: string,
  bytes: Uint8Array,
  preferredSkillPath?: string | null,
): SkillInput[] {
  if (preferredSkillPath) return [parseSkillZip(filename, bytes, preferredSkillPath)];
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Skill 压缩包不是有效的 ZIP 文件");
  }
  const paths = Object.keys(files).filter((path) => !path.endsWith("/") && !path.startsWith("__MACOSX/"));
  const skillPaths = paths
    .filter((path) => /(^|\/)SKILL\.md$/i.test(path))
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
  if (!skillPaths.length) throw new Error("压缩包中没有找到 SKILL.md");
  return skillPaths.map((skillPath) => packageSkillFromArchive(filename, files, paths, skillPath));
}

export function parseSkillFile(filename: string, bytes: Uint8Array, preferredSkillPath?: string | null): SkillInput {
  if (filename.toLocaleLowerCase().endsWith(".zip")) return parseSkillZip(filename, bytes, preferredSkillPath);
  if (filename.toLocaleLowerCase().endsWith(".md")) return parseSkillMarkdown(filename, bytes);
  throw new Error("请选择 .md 或 .zip 格式的 Skill 文件");
}
