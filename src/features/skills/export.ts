import { strToU8, unzipSync, zipSync } from "fflate";
import type { Skill } from "./types";

function safeFolderName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-") || "skill";
}

function packageFiles(skill: Skill): Record<string, Uint8Array> {
  if (skill.packageType === "zip" && skill.packageData) {
    let files: Record<string, Uint8Array> = {};
    try { files = unzipSync(skill.packageData); } catch { /* fall back to a clean package */ }
    const skillPath = Object.keys(files)
      .filter((path) => /(^|\/)SKILL\.md$/i.test(path))
      .sort((left, right) => left.split("/").length - right.split("/").length)[0];
    if (skillPath) {
      const root = skillPath.slice(0, -"SKILL.md".length);
      const relativeFiles: Record<string, Uint8Array> = {};
      for (const [path, data] of Object.entries(files)) {
        if (!path.startsWith(root)) continue;
        const relative = path.slice(root.length);
        if (!relative || relative.split("/").includes("..")) continue;
        relativeFiles[relative] = data;
      }
      relativeFiles["SKILL.md"] = strToU8(skill.content);
      return relativeFiles;
    }
  }
  return { "SKILL.md": strToU8(skill.content) };
}

export function referencedSkillNames(skill: Pick<Skill, "content">): string[] {
  const names = new Set<string>();
  for (const match of skill.content.matchAll(/\.\.\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\//gi)) {
    names.add(match[1].toLocaleLowerCase());
  }
  return [...names];
}

function resolveDependencies(skills: Skill[], library: Skill[]): { included: Skill[]; missing: string[] } {
  const byName = new Map(library.map((skill) => [skill.name.toLocaleLowerCase(), skill]));
  const included = new Map(skills.map((skill) => [skill.name.toLocaleLowerCase(), skill]));
  const missing = new Set<string>();
  const queue = [...skills];

  while (queue.length) {
    const current = queue.shift() as Skill;
    for (const name of referencedSkillNames(current)) {
      if (included.has(name)) continue;
      const dependency = byName.get(name);
      if (!dependency) {
        missing.add(name);
        continue;
      }
      included.set(name, dependency);
      queue.push(dependency);
    }
  }
  return { included: [...included.values()], missing: [...missing] };
}

function packageSkills(skills: Skill[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const skill of skills) {
    const folder = safeFolderName(skill.name);
    for (const [path, data] of Object.entries(packageFiles(skill))) {
      files[`${folder}/${path}`] = data;
    }
  }
  return zipSync(files, { level: 6 });
}

export interface SkillExportArchive {
  filename: string;
  data: Uint8Array;
  includedSkillNames: string[];
  missingDependencies: string[];
}

export function buildSkillExport(skill: Skill, library: Skill[] = [skill]): SkillExportArchive {
  const resolved = resolveDependencies([skill], library);
  return {
    filename: `${safeFolderName(skill.name)}.zip`,
    data: packageSkills(resolved.included),
    includedSkillNames: resolved.included.map((item) => item.name),
    missingDependencies: resolved.missing,
  };
}

export function buildSkillCollectionExport(name: string, skills: Skill[], library: Skill[] = skills): SkillExportArchive {
  const resolved = resolveDependencies(skills, library);
  return {
    filename: `${safeFolderName(name)}.zip`,
    data: packageSkills(resolved.included),
    includedSkillNames: resolved.included.map((item) => item.name),
    missingDependencies: resolved.missing,
  };
}
