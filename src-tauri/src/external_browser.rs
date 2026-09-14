use std::process::Command;

#[cfg(target_os = "macos")]
fn macos_open_args(url: &str, browser: &str) -> Result<Vec<String>, String> {
    if browser == "system" {
        return Ok(vec![url.to_string()]);
    }
    let app = match browser {
        "safari" => "Safari",
        "chrome" => "Google Chrome",
        "edge" => "Microsoft Edge",
        "firefox" => "Firefox",
        _ => return Err("不支持的浏览器".to_string()),
    };
    Ok(vec!["-a".to_string(), app.to_string(), url.to_string()])
}

#[tauri::command]
pub fn open_url_with_browser(url: String, browser: String) -> Result<(), String> {
    let parsed = tauri::Url::parse(&url).map_err(|_| "网址格式无效".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("只允许打开 http 或 https 地址".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let args = macos_open_args(parsed.as_str(), &browser)?;
        let status = Command::new("/usr/bin/open")
            .args(args)
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

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn opens_system_browser_without_an_app_override() {
        assert_eq!(
            macos_open_args("https://example.com/", "system").unwrap(),
            vec!["https://example.com/"]
        );
    }

    #[test]
    fn opens_selected_browser_by_application_name() {
        assert_eq!(
            macos_open_args("https://example.com/", "chrome").unwrap(),
            vec!["-a", "Google Chrome", "https://example.com/"]
        );
        assert!(macos_open_args("https://example.com/", "unknown").is_err());
    }
}
