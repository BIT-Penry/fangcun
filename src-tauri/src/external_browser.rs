use std::process::Command;

#[tauri::command]
pub fn open_url_with_browser(url: String, browser: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|_| "网址格式无效".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("只允许打开 http 或 https 地址".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let app = match browser.as_str() {
            "safari" => "Safari",
            "chrome" => "Google Chrome",
            "edge" => "Microsoft Edge",
            "firefox" => "Firefox",
            _ => return Err("不支持的浏览器".to_string()),
        };
        let status = Command::new("/usr/bin/open")
            .args(["-a", app, parsed.as_str()])
            .status()
            .map_err(|error| format!("无法启动浏览器: {error}"))?;
        return status
            .success()
            .then_some(())
            .ok_or_else(|| "浏览器不可用".to_string());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = browser;
        Err("当前平台暂不支持指定浏览器".to_string())
    }
}
