import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

export type BrowserPreference = "system" | "safari" | "chrome" | "edge" | "firefox";

export async function openExternalUrl(value: string, browser: BrowserPreference = "system"): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只允许在浏览器中打开 http 或 https 地址");
  }
  try {
    await invoke("open_url_with_browser", { url: url.toString(), browser });
  } catch {
    await openUrl(url.toString());
  }
}
