export type SkillPackageType = "markdown" | "zip";

export type SkillResourceKind = "script" | "reference" | "asset" | "other";

export interface SkillResourceSummary {
  path: string;
  kind: SkillResourceKind;
  size: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  notes: string;
  sourceName: string;
  packageType: SkillPackageType;
  packageData: Uint8Array | null;
  coverDataUrl: string | null;
  isFavorite: boolean;
  tags: string[];
  compatibility: string[];
  resources: SkillResourceSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillInput {
  name: string;
  description: string;
  content: string;
  notes: string;
  sourceName: string;
  packageType: SkillPackageType;
  packageData: Uint8Array | null;
  coverDataUrl: string | null;
  isFavorite: boolean;
  tags: string[];
  compatibility: string[];
  resources: SkillResourceSummary[];
}

export interface ListSkillsOptions {
  includePackageData?: boolean;
}

export interface SkillsStore {
  listSkills(options?: ListSkillsOptions): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill | null>;
  createSkill(input: SkillInput): Promise<string>;
  updateSkill(id: string, input: SkillInput): Promise<void>;
  deleteSkill(id: string): Promise<void>;
  searchSkills(query: string, limit?: number): Promise<Skill[]>;
}
