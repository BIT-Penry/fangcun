import { useEffect, useState } from "react";
import { Archive, Database, ExternalLink, FileInput, Globe2, Info, KeyRound, Monitor, Moon, Palette, RotateCcw, Sparkles, Sun, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useBrowserPreference } from "../../app/browser/BrowserPreferenceProvider";
import { useTheme } from "../../app/theme/ThemeProvider";
import type { ThemePreference } from "../../app/theme/theme";
import { useBackupService } from "./BackupContext";
import { openExternalUrl } from "../../shared/openExternal";
import type { BrowserPreference } from "../../shared/openExternal";
import { deleteAiServiceConfig, getAiServiceConfig, saveAiServiceConfig, type AiProviderId, type AiServiceConfig } from "../../shared/aiService";

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

const AI_PROVIDER_OPTIONS: readonly {
  value: AiProviderId;
  label: string;
  description: string;
  baseUrl: string;
  model: string;
}[] = [
  { value: "deepseek", label: "DeepSeek", description: "中文整理，性价比较高", baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" },
  { value: "kimi", label: "Kimi", description: "多模态与中文内容", baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k3" },
  { value: "openai", label: "OpenAI / GPT", description: "通用理解与稳定输出", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6" },
  { value: "custom", label: "自定义", description: "OpenAI 兼容接口", baseUrl: "", model: "" },
];

export function SettingsPage() {
  const { preference, setPreference, saveStatus } = useTheme();
  const { preference: browserPreference, setPreference: setBrowserPreference, saveStatus: browserSaveStatus } = useBrowserPreference();
  const backupService = useBackupService();
  const [appInfo, setAppInfo] = useState<{ version: string; dataLocation: string } | null>(null);
  const [backupStatus, setBackupStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [backupMessage, setBackupMessage] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProviderId>("deepseek");
  const [aiDisplayName, setAiDisplayName] = useState("DeepSeek");
  const [aiBaseUrl, setAiBaseUrl] = useState("https://api.deepseek.com");
  const [aiModel, setAiModel] = useState("deepseek-v4-flash");
  const [aiKey, setAiKey] = useState("");
  const [savedAiConfig, setSavedAiConfig] = useState<AiServiceConfig | null>(null);
  const [aiStatus, setAiStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [aiMessage, setAiMessage] = useState("正在检查钥匙串…");

  useEffect(() => {
    void backupService.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
    void getAiServiceConfig()
      .then((config) => {
        setSavedAiConfig(config);
        setAiProvider(config.provider);
        setAiDisplayName(config.displayName);
        setAiBaseUrl(config.baseUrl);
        setAiModel(config.model);
        setAiStatus("idle");
        setAiMessage(config.configured ? `${config.displayName} 已启用，API Key 保存在 macOS 钥匙串` : "尚未配置 AI 服务");
      })
      .catch(() => {
        setAiStatus("error");
        setAiMessage("无法读取 macOS 钥匙串");
      });
  }, [backupService]);

  const selectAiProvider = (provider: AiProviderId) => {
    const option = AI_PROVIDER_OPTIONS.find((candidate) => candidate.value === provider)!;
    const saved = savedAiConfig?.configured && savedAiConfig.provider === provider ? savedAiConfig : null;
    setAiProvider(provider);
    setAiDisplayName(saved?.displayName ?? (provider === "custom" ? "" : option.label.replace(" / GPT", "")));
    setAiBaseUrl(saved?.baseUrl ?? option.baseUrl);
    setAiModel(saved?.model ?? option.model);
    setAiKey("");
    setAiStatus("idle");
    setAiMessage(savedAiConfig?.configured && savedAiConfig.provider === provider
      ? `${savedAiConfig.displayName} 已保存；可修改模型后重新验证`
      : "输入该服务的 API Key 后验证并启用");
  };

  const saveAiService = async () => {
    setAiStatus("saving");
    setAiMessage(`正在验证${aiDisplayName || "自定义服务"}连接…`);
    try {
      await saveAiServiceConfig({ provider: aiProvider, displayName: aiDisplayName, baseUrl: aiBaseUrl, model: aiModel, apiKey: aiKey });
      const displayName = aiProvider === "custom" ? aiDisplayName.trim() : AI_PROVIDER_OPTIONS.find((option) => option.value === aiProvider)!.label.replace(" / GPT", "");
      const config = { configured: true, provider: aiProvider, displayName, baseUrl: aiBaseUrl.trim().replace(/\/$/, ""), model: aiModel.trim() };
      setSavedAiConfig(config);
      setAiKey("");
      setAiStatus("saved");
      setAiMessage(`连接成功，已启用 ${displayName}`);
    } catch (error) {
      setAiStatus("error");
      setAiMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const removeAiService = async () => {
    if (!window.confirm("删除已保存的 AI 服务和 API Key？之后将无法使用智能整理和公式识别。")) return;
    setAiStatus("saving");
    setAiMessage("正在删除 AI 配置…");
    try {
      await deleteAiServiceConfig();
      setSavedAiConfig((current) => current ? { ...current, configured: false } : null);
      setAiStatus("idle");
      setAiMessage("已从 macOS 钥匙串删除 AI 配置");
    } catch (error) {
      setAiStatus("error");
      setAiMessage(error instanceof Error ? error.message : String(error));
    }
  };

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

  const normalizedAiBaseUrl = aiBaseUrl.trim().replace(/\/$/, "");
  const canReuseAiKey = Boolean(
    savedAiConfig?.configured
    && savedAiConfig.provider === aiProvider
    && savedAiConfig.baseUrl === normalizedAiBaseUrl,
  );
  const aiFormComplete = Boolean(
    aiModel.trim()
    && (aiProvider !== "custom" || (aiDisplayName.trim() && normalizedAiBaseUrl))
    && (aiKey.trim() || canReuseAiKey),
  );

  return (
    <section className="settings-page">
      <header className="bookmarks-header settings-page-header">
        <div><h1>设置</h1><p className="page-description">调整使用偏好，管理智能服务与本地数据。</p></div>
      </header>

      <div className="settings-sections">
        <section className="settings-section">
          <header className="settings-section-heading">
            <span className="settings-section-icon"><Palette aria-hidden="true" size={17} /></span>
            <div><h2>外观与偏好</h2><p>选择显示方式和书签打开位置。</p></div>
          </header>
          <div className="settings-panel">
            <div className="settings-block">
              <header><div><h3>主题</h3><p>在系统、浅色和深色外观之间切换。</p></div><span role="status" className={`save-status ${saveStatus}`}>{saveStatus === "saving" && "保存中…"}{saveStatus === "saved" && "已保存"}{saveStatus === "error" && "保存失败"}</span></header>
              <div className="theme-options">
                {OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return <label key={option.value} className={preference === option.value ? "theme-option active" : "theme-option"}>
                    <input type="radio" name="theme" value={option.value} checked={preference === option.value} disabled={saveStatus === "saving"} onChange={() => void setPreference(option.value)} />
                    <Icon aria-hidden="true" size={18} /><span>{option.label}</span>
                  </label>;
                })}
              </div>
            </div>
            <div className="settings-rule" />
            <div className="settings-block browser-card">
              <header>
                <div><h3>默认浏览器</h3><p>用于打开书签中的网页。</p></div>
                <span role="status" className={`save-status ${browserSaveStatus}`}>
                  {browserSaveStatus === "saving" && "保存中…"}
                  {browserSaveStatus === "saved" && "已保存"}
                  {browserSaveStatus === "error" && "保存失败"}
                </span>
              </header>
              <div className="browser-preference-row">
                <Globe2 aria-hidden="true" size={18} />
                <div><strong>书签打开方式</strong><span>指定浏览器不可用时，自动使用系统默认浏览器。</span></div>
                <select aria-label="默认浏览器" value={browserPreference} disabled={browserSaveStatus === "saving"}
                  onChange={(event) => void setBrowserPreference(event.target.value as BrowserPreference)}>
                  {BROWSER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <header className="settings-section-heading">
            <span className="settings-section-icon"><Sparkles aria-hidden="true" size={17} /></span>
            <div><h2>智能服务</h2><p>用于内容整理、技能分类与公式识别。</p></div>
          </header>
          <div className="settings-panel ai-service-card">
            <div className="settings-block">
              <header>
                <div><h3>AI 模型</h3><p>选择服务商，再填写模型与 API Key。</p></div>
                <span className={savedAiConfig?.configured ? "ai-service-badge configured" : "ai-service-badge"}>
                  <Sparkles aria-hidden="true" size={12} />{savedAiConfig?.configured ? `已启用 ${savedAiConfig.displayName}` : "未配置"}
                </span>
              </header>
              <div className="ai-provider-options" role="radiogroup" aria-label="AI 服务">
                {AI_PROVIDER_OPTIONS.map((option) => <button key={option.value} type="button" role="radio"
                  aria-checked={aiProvider === option.value} className={aiProvider === option.value ? "ai-provider-option active" : "ai-provider-option"}
                  disabled={aiStatus === "saving"} onClick={() => selectAiProvider(option.value)}>
                  <strong>{option.label}</strong><span>{option.description}</span>
                </button>)}
              </div>
              <div className="ai-service-fields">
                {aiProvider === "custom" && <>
                  <label>服务名称<input value={aiDisplayName} placeholder="例如：我的模型网关" disabled={aiStatus === "saving"}
                    onChange={(event) => setAiDisplayName(event.target.value)} /></label>
                  <label>Base URL<input value={aiBaseUrl} placeholder="https://example.com/v1" disabled={aiStatus === "saving"}
                    onChange={(event) => setAiBaseUrl(event.target.value)} /></label>
                </>}
                <label>模型<input value={aiModel} placeholder="输入模型 ID" disabled={aiStatus === "saving"}
                  onChange={(event) => setAiModel(event.target.value)} /></label>
                <label>API Key<input type="password" autoComplete="new-password" value={aiKey}
                  placeholder={canReuseAiKey ? "留空则继续使用已保存的 Key" : "输入该服务的 API Key"}
                  disabled={aiStatus === "saving"} onChange={(event) => setAiKey(event.target.value)} /></label>
              </div>
              <div className="ai-service-actions">
                <KeyRound aria-hidden="true" size={17} />
                <p role="status" className={`ai-service-message ${aiStatus}`}>{aiMessage}</p>
                <button type="button" className="button-primary" disabled={!aiFormComplete || aiStatus === "saving"}
                  onClick={() => void saveAiService()}>{aiStatus === "saving" ? "验证中…" : "验证并启用"}</button>
                {savedAiConfig?.configured && <button type="button" className="icon-button danger" aria-label="删除 AI 服务配置"
                  disabled={aiStatus === "saving"} onClick={() => void removeAiService()}><Trash2 aria-hidden="true" size={15} /></button>}
              </div>
              <p className="settings-note">内置服务使用官方接口，自定义项支持 OpenAI 兼容 API。文本仅在你触发智能整理时发送；公式截图仅在点击识别后发送给 Kimi。API Key 只保存在系统钥匙串。</p>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <header className="settings-section-heading">
            <span className="settings-section-icon"><Database aria-hidden="true" size={17} /></span>
            <div><h2>数据管理</h2><p>备份资料，或导入浏览器书签。</p></div>
          </header>
          <div className="settings-panel data-card">
            <div className="settings-block">
              <header><div><h3>备份与恢复</h3><p>保存完整数据快照，需要时可恢复。</p></div></header>
              <div className="data-location"><span>数据位置</span><code>{appInfo?.dataLocation ?? "正在读取…"}</code></div>
              <div className="settings-actions">
                <button type="button" className="button-primary" onClick={() => void createBackup()} disabled={backupStatus === "working"}><Archive aria-hidden="true" size={16} />创建完整备份</button>
                <button type="button" className="button-secondary" onClick={() => void restoreBackup()} disabled={backupStatus === "working"}><RotateCcw aria-hidden="true" size={16} />从备份恢复</button>
              </div>
              {backupMessage && <p role="status" className={`backup-message ${backupStatus}`}>{backupMessage}</p>}
              <p className="settings-note">备份为 ZIP 文件，包含一致性的 SQLite 快照和格式清单；恢复前会自动保留当前数据库。</p>
            </div>
            <div className="settings-rule" />
            <div className="settings-link-row">
              <FileInput aria-hidden="true" size={19} />
              <div><h3>浏览器书签</h3><p>支持 Chrome、Safari、Edge 和 Firefox 导出的 Bookmark HTML。</p></div>
              <Link className="button-secondary" to="/bookmarks">导入书签</Link>
            </div>
          </div>
        </section>

        <section className="settings-section settings-about-section">
          <header className="settings-section-heading">
            <span className="settings-section-icon"><Info aria-hidden="true" size={17} /></span>
            <div><h2>关于方寸</h2><p>版本信息与项目地址。</p></div>
          </header>
          <div className="settings-panel">
            <div className="settings-link-row settings-about-row">
              <div className="app-monogram">方</div>
              <div><h3>方寸</h3><p>版本 {appInfo?.version ?? "0.1.0"}，本地优先，不含账号与遥测。</p></div>
              <a className="button-secondary" href="https://github.com/BIT-Penry/fangcun"
                onClick={(event) => { event.preventDefault(); void openExternalUrl(event.currentTarget.href); }}>
                查看源码 <ExternalLink aria-hidden="true" size={13} />
              </a>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
