import { useEffect, useState } from "react";
import { Archive, Database, ExternalLink, FileInput, Globe2, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useBrowserPreference } from "../../app/browser/BrowserPreferenceProvider";
import { useTheme } from "../../app/theme/ThemeProvider";
import type { ThemePreference } from "../../app/theme/theme";
import { useBackupService } from "./BackupContext";
import { openExternalUrl } from "../../shared/openExternal";
import type { BrowserPreference } from "../../shared/openExternal";

const OPTIONS: readonly { value: ThemePreference; label: string; icon: typeof Monitor }[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

const BROWSER_OPTIONS: readonly { value: BrowserPreference; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "safari", label: "Safari" },
  { value: "chrome", label: "Chrome" },
  { value: "edge", label: "Edge" },
  { value: "firefox", label: "Firefox" },
];

export function SettingsPage() {
  const { preference, setPreference, saveStatus } = useTheme();
  const { preference: browserPreference, setPreference: setBrowserPreference, saveStatus: browserSaveStatus } = useBrowserPreference();
  const backupService = useBackupService();
  const [appInfo, setAppInfo] = useState<{ version: string; dataLocation: string } | null>(null);
  const [backupStatus, setBackupStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [backupMessage, setBackupMessage] = useState("");

  useEffect(() => {
    void backupService.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
  }, [backupService]);

  const createBackup = async () => {
    setBackupStatus("working");
    setBackupMessage("正在创建一致性快照…");
    try {
      const path = await backupService.createBackup();
      if (!path) {
        setBackupStatus("idle");
        setBackupMessage("");
        return;
      }
      setBackupStatus("success");
      setBackupMessage(`备份已保存至 ${path}`);
    } catch {
      setBackupStatus("error");
      setBackupMessage("创建备份失败，请确认目标位置可写后重试");
    }
  };

  const restoreBackup = async () => {
    if (!window.confirm("恢复会用备份内容替换当前资料。方寸会先自动保存当前数据库，再重新打开应用。是否继续？")) return;
    setBackupStatus("working");
    setBackupMessage("正在校验备份并保存当前资料…");
    try {
      const safetyName = await backupService.restoreBackup();
      if (!safetyName) {
        setBackupStatus("idle");
        setBackupMessage("");
      }
    } catch (error) {
      setBackupStatus("error");
      setBackupMessage(error instanceof Error ? error.message : "恢复失败，当前资料未被替换");
    }
  };

  return (
    <section className="settings-page">
      <header className="bookmarks-header">
        <div><p className="eyebrow">LOCAL CONTROL</p><h1>设置</h1><p className="page-description">管理外观、本地数据与应用信息。</p></div>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <header><div><p className="eyebrow">APPEARANCE</p><h2>主题</h2></div><span role="status" className={`save-status ${saveStatus}`}>{saveStatus === "saving" && "保存中…"}{saveStatus === "saved" && "已保存"}{saveStatus === "error" && "保存失败"}</span></header>
          <div className="theme-options">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              return <label key={option.value} className={preference === option.value ? "theme-option active" : "theme-option"}>
                <input type="radio" name="theme" value={option.value} checked={preference === option.value} disabled={saveStatus === "saving"} onChange={() => void setPreference(option.value)} />
                <Icon aria-hidden="true" size={18} /><span>{option.label}</span>
              </label>;
            })}
          </div>
        </section>

        <section className="settings-card browser-card">
          <header>
            <div><p className="eyebrow">LINK HANDOFF</p><h2>默认浏览器</h2></div>
            <span role="status" className={`save-status ${browserSaveStatus}`}>
              {browserSaveStatus === "saving" && "保存中…"}
              {browserSaveStatus === "saved" && "已保存"}
              {browserSaveStatus === "error" && "保存失败"}
            </span>
          </header>
          <div className="browser-preference-row">
            <Globe2 aria-hidden="true" size={18} />
            <div><strong>书签打开方式</strong><span>指定浏览器不可用时会自动退回系统默认。</span></div>
            <select aria-label="默认浏览器" value={browserPreference} disabled={browserSaveStatus === "saving"}
              onChange={(event) => void setBrowserPreference(event.target.value as BrowserPreference)}>
              {BROWSER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </section>

        <section className="settings-card data-card">
          <header><div><p className="eyebrow">LOCAL DATA</p><h2>数据与备份</h2></div><Database aria-hidden="true" size={20} /></header>
          <div className="data-location"><span>数据位置</span><code>{appInfo?.dataLocation ?? "正在读取…"}</code></div>
          <div className="settings-actions">
            <button type="button" className="button-primary" onClick={() => void createBackup()} disabled={backupStatus === "working"}><Archive aria-hidden="true" size={16} />创建完整备份</button>
            <button type="button" className="button-secondary" onClick={() => void restoreBackup()} disabled={backupStatus === "working"}><RotateCcw aria-hidden="true" size={16} />从备份恢复</button>
          </div>
          {backupMessage && <p role="status" className={`backup-message ${backupStatus}`}>{backupMessage}</p>}
          <p className="settings-note">备份为 ZIP 文件，包含一致性的 SQLite 快照和格式清单；恢复前会自动保留当前数据库。</p>
        </section>

        <section className="settings-card compact-card">
          <FileInput aria-hidden="true" size={19} />
          <div><h2>浏览器书签</h2><p>支持 Chrome、Safari、Edge 和 Firefox 导出的 Bookmark HTML。</p></div>
          <Link className="button-secondary" to="/bookmarks">前往导入</Link>
        </section>

        <section className="settings-card compact-card">
          <div className="app-monogram">方</div>
          <div><h2>方寸 · Fangcun</h2><p>版本 {appInfo?.version ?? "0.1.0"} · 本地优先，不含账号与遥测。</p></div>
          <a className="button-secondary" href="https://github.com/BIT-Penry/fangcun"
            onClick={(event) => { event.preventDefault(); void openExternalUrl(event.currentTarget.href); }}>
            源码 <ExternalLink aria-hidden="true" size={13} />
          </a>
        </section>
      </div>
    </section>
  );
}
