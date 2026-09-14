import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { openExternalUrl } from "./openExternal";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

describe("openExternalUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the native browser command for the system default", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await openExternalUrl("https://example.com", "system");

    expect(invoke).toHaveBeenCalledWith("open_url_with_browser", {
      url: "https://example.com/",
      browser: "system",
    });
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("falls back to the Tauri opener when the native command fails", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("browser unavailable"));
    vi.mocked(openUrl).mockResolvedValue(undefined);

    await openExternalUrl("https://example.com/docs", "chrome");

    expect(openUrl).toHaveBeenCalledWith("https://example.com/docs");
  });

  it("rejects unsafe protocols before invoking the operating system", async () => {
    await expect(openExternalUrl("file:///tmp/example")).rejects.toThrow("只允许在浏览器中打开 http 或 https 地址");
    expect(invoke).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
  });
});
