import { openUrl } from "@tauri-apps/plugin-opener";

export async function openExternalUrl(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只允许在浏览器中打开 http 或 https 地址");
  }
  await openUrl(url.toString());
}
