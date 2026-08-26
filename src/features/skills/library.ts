import type { Skill } from "./types";

export interface SkillCollection {
  sourceName: string;
  name: string;
  skills: Skill[];
  tags: string[];
  updatedAt: string;
}

const ACRONYMS = new Map([
  ["ai", "AI"],
  ["api", "API"],
  ["gpt", "GPT"],
  ["llm", "LLM"],
  ["ui", "UI"],
  ["ux", "UX"],
]);

function titleToken(token: string): string {
  const lower = token.toLocaleLowerCase();
  return ACRONYMS.get(lower) ?? `${lower.charAt(0).toLocaleUpperCase()}${lower.slice(1)}`;
}

export function collectionNameFromSource(sourceName: string): string {
  try {
    const url = new URL(sourceName);
    const parts = url.pathname.split("/").filter(Boolean);
    const repository = (parts[1] ?? parts[parts.length - 1] ?? "技能合集").replace(/\.git$/i, "");
    return repository.split(/[-_\s]+/).filter(Boolean).map(titleToken).join(" ") || "技能合集";
  } catch {
    return "技能合集";
  }
}

export function collectionSourceLabel(sourceName: string): string {
  try {
    const url = new URL(sourceName);
    const parts = url.pathname.split("/").filter(Boolean).slice(0, 2);
    return [url.hostname.replace(/^www\./, ""), ...parts].join("/");
  } catch {
    return sourceName;
  }
}

function collectionTags(skills: Skill[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const skill of skills) {
    for (const tag of skill.tags) {
      const key = tag.toLocaleLowerCase();
      const current = counts.get(key);
      counts.set(key, { label: current?.label ?? tag, count: (current?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN"))
    .slice(0, 2)
    .map((item) => item.label);
}

export function groupSkillsBySource(skills: Skill[]): { collections: SkillCollection[]; singles: Skill[] } {
  const linkGroups = new Map<string, Skill[]>();
  const singles: Skill[] = [];

  for (const skill of skills) {
    if (!/^https?:\/\//i.test(skill.sourceName)) {
      singles.push(skill);
      continue;
    }
    linkGroups.set(skill.sourceName, [...(linkGroups.get(skill.sourceName) ?? []), skill]);
  }

  const collections: SkillCollection[] = [];
  for (const [sourceName, groupedSkills] of linkGroups) {
    if (groupedSkills.length === 1) {
      singles.push(groupedSkills[0]);
      continue;
    }
    const updatedAt = groupedSkills.reduce(
      (latest, skill) => skill.updatedAt > latest ? skill.updatedAt : latest,
      groupedSkills[0].updatedAt,
    );
    collections.push({
      sourceName,
      name: collectionNameFromSource(sourceName),
      skills: groupedSkills,
      tags: collectionTags(groupedSkills),
      updatedAt,
    });
  }

  collections.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return { collections, singles };
}
