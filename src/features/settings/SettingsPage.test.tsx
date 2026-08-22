import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "../../app/theme/ThemeProvider";
import { BackupProvider } from "./BackupContext";
import type { BackupService } from "./BackupService";
import { SettingsPage } from "./SettingsPage";
import { BrowserPreferenceProvider } from "../../app/browser/BrowserPreferenceProvider";
import { getDeepSeekStatus, saveDeepSeekApiKey } from "../../shared/deepseek";

vi.mock("../../shared/deepseek", () => ({
  getDeepSeekStatus: vi.fn().mockResolvedValue({ configured: false }),
  saveDeepSeekApiKey: vi.fn().mockResolvedValue(undefined),
  deleteDeepSeekApiKey: vi.fn().mockResolvedValue(undefined),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function ProgrammaticThemeControls() {
  const { setPreference } = useTheme();
  return (
    <>
      <button onClick={() => void setPreference("dark")}>选择深色</button>
      <button onClick={() => void setPreference("light")}>选择浅色</button>
    </>
  );
}

function createBackupService(overrides: Partial<BackupService> = {}): BackupService {
  return {
    getAppInfo: vi.fn().mockResolvedValue({ version: "0.1.0", dataLocation: "/local/fangcun" }),
    createBackup: vi.fn().mockResolvedValue("/backup/fangcun.zip"),
    restoreBackup: vi.fn().mockResolvedValue("fangcun-before-restore.zip"),
    ...overrides,
  } as unknown as BackupService;
}

function renderSettings(
  onPreferenceChange: (preference: "system" | "light" | "dark") => Promise<void>,
  backupService = createBackupService(),
  onBrowserChange = vi.fn().mockResolvedValue(undefined),
) {
  return render(
    <MemoryRouter>
      <ThemeProvider initialPreference="system" onPreferenceChange={onPreferenceChange}>
        <BrowserPreferenceProvider initialPreference="system" onPreferenceChange={onBrowserChange}>
          <BackupProvider service={backupService}><SettingsPage /></BackupProvider>
        </BrowserPreferenceProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  it("disables theme choices while persisting a selection", async () => {
    const user = userEvent.setup();
    const write = deferred<void>();
    const save = vi.fn().mockReturnValue(write.promise);
    renderSettings(save);
    await user.click(screen.getByRole("radio", { name: "深色" }));
    expect(save).toHaveBeenCalledWith("dark");
    expect(screen.getByText("保存中…")).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "浅色" }));
    expect(save).toHaveBeenCalledOnce();
    write.resolve();
    await waitFor(() => expect(screen.getByText("已保存")).toBeInTheDocument());
  });

  it("ignores programmatic preference changes while a save is in flight", async () => {
    const user = userEvent.setup();
    const write = deferred<void>();
    const save = vi.fn().mockReturnValue(write.promise);
    render(
      <ThemeProvider initialPreference="system" onPreferenceChange={save}>
        <ProgrammaticThemeControls />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "选择深色" }));
    await user.click(screen.getByRole("button", { name: "选择浅色" }));
    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith("dark");
    write.resolve();
  });

  it("restores the previous selection after a failed save", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockRejectedValue(new Error("write failed"));
    renderSettings(save);
    await user.click(screen.getByRole("radio", { name: "深色" }));
    await waitFor(() => expect(screen.getByText("保存失败")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("radio", { name: "跟随系统" })).toBeChecked());
  });

  it("creates a complete backup from the settings page", async () => {
    const user = userEvent.setup();
    const backupService = createBackupService();
    renderSettings(vi.fn().mockResolvedValue(undefined), backupService);
    await user.click(screen.getByRole("button", { name: "创建完整备份" }));
    await waitFor(() => expect(backupService.createBackup).toHaveBeenCalledOnce());
    expect(screen.getByText(/备份已保存至/)).toHaveTextContent("/backup/fangcun.zip");
  });

  it("persists the preferred browser", async () => {
    const user = userEvent.setup();
    const saveBrowser = vi.fn().mockResolvedValue(undefined);
    renderSettings(vi.fn().mockResolvedValue(undefined), createBackupService(), saveBrowser);
    await user.selectOptions(screen.getByRole("combobox", { name: "默认浏览器" }), "chrome");
    expect(saveBrowser).toHaveBeenCalledWith("chrome");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "默认浏览器" })).toHaveValue("chrome"));
  });

  it("validates and saves the DeepSeek API key from settings", async () => {
    const user = userEvent.setup();
    vi.mocked(getDeepSeekStatus).mockResolvedValueOnce({ configured: false });
    vi.mocked(saveDeepSeekApiKey).mockResolvedValueOnce(undefined);
    renderSettings(vi.fn().mockResolvedValue(undefined));

    expect(await screen.findByText("尚未配置 DeepSeek API Key")).toBeInTheDocument();
    await user.type(screen.getByLabelText("DeepSeek API Key"), "sk-test-key-123");
    await user.click(screen.getByRole("button", { name: "验证并保存" }));

    await waitFor(() => expect(saveDeepSeekApiKey).toHaveBeenCalledWith("sk-test-key-123"));
    expect(screen.getByText("连接成功，API Key 已保存到 macOS 钥匙串")).toBeInTheDocument();
  });
});
