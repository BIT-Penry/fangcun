import { invoke } from "@tauri-apps/api/core";
import { readFile, remove } from "@tauri-apps/plugin-fs";

interface GithubSkillResponse {
  filename: string;
  localPath: string;
  preferredSkillPath: string | null;
}

export async function fetchGithubSkill(url: string): Promise<{
  filename: string;
  data: Uint8Array;
  preferredSkillPath: string | null;
}> {
  const response = await invoke<GithubSkillResponse>("fetch_github_skill", { url });
  try {
    return {
      filename: response.filename,
      data: await readFile(response.localPath),
      preferredSkillPath: response.preferredSkillPath,
    };
  } finally {
    try { await remove(response.localPath); } catch { /* temporary download is best-effort cleanup */ }
  }
}
