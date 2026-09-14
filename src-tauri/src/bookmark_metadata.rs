use regex::Regex;
use reqwest::header::{ACCEPT, CONTENT_TYPE, RANGE};
use reqwest::Url;
use serde::Serialize;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::OnceLock;
use std::time::Duration;

const MAX_HTML_BYTES: usize = 1024 * 1024;
const MAX_VISIBLE_TEXT_CHARS: usize = 12_000;

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkMetadata {
    title: Option<String>,
    description: Option<String>,
    favicon_url: Option<String>,
    ai_enhanced: bool,
    warning: Option<String>,
}

struct FetchedPage {
    final_url: String,
    metadata: BookmarkMetadata,
    visible_text: String,
}

#[tauri::command]
pub async fn fetch_bookmark_metadata(url: String) -> Result<BookmarkMetadata, String> {
    Ok(fetch_page(&url).await?.metadata)
}

#[tauri::command]
pub async fn fetch_ai_bookmark_metadata(url: String) -> Result<BookmarkMetadata, String> {
    let page = fetch_page(&url).await?;
    let input = crate::ai_service::PageSummaryInput {
        url: &page.final_url,
        page_title: page.metadata.title.as_deref(),
        page_description: page.metadata.description.as_deref(),
        visible_text: &page.visible_text,
    };
    match crate::ai_service::enhance_bookmark(input).await {
        Ok(generated) => Ok(BookmarkMetadata {
            title: Some(generated.title),
            description: Some(generated.description),
            favicon_url: page.metadata.favicon_url,
            ai_enhanced: true,
            warning: None,
        }),
        Err(error) if error.contains("配置") || error.contains("API Key") => Err(error),
        Err(error) => Ok(BookmarkMetadata {
            warning: Some(if error.contains("JSON 格式") {
                "AI 整理未完成，已保留网页原始信息，可直接修改或重试".to_string()
            } else {
                format!("{error}，已改用网页原始信息")
            }),
            ..page.metadata
        }),
    }
}

#[tauri::command]
pub async fn fetch_import_bookmark_metadata(url: String) -> Result<BookmarkMetadata, String> {
    let page = fetch_page(&url).await?;
    let input = crate::ai_service::PageSummaryInput {
        url: &page.final_url,
        page_title: page.metadata.title.as_deref(),
        page_description: page.metadata.description.as_deref(),
        visible_text: &page.visible_text,
    };
    match crate::ai_service::enhance_bookmark_description(input).await {
        Ok(generated) => Ok(BookmarkMetadata {
            title: None,
            description: Some(generated.description),
            favicon_url: page.metadata.favicon_url,
            ai_enhanced: true,
            warning: None,
        }),
        Err(error) => Ok(BookmarkMetadata {
            title: None,
            warning: Some(format!("{error}，已改用网页原始简介")),
            ..page.metadata
        }),
    }
}

async fn fetch_page(url: &str) -> Result<FetchedPage, String> {
    let requested_url = validate_remote_url(url)?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(5))
        .user_agent("Fangcun/0.1 bookmark metadata fetcher")
        .build()
        .map_err(|_| "无法初始化网页请求".to_string())?;

    let mut response = client
        .get(requested_url)
        .header(ACCEPT, "text/html,application/xhtml+xml")
        .header(RANGE, format!("bytes=0-{}", MAX_HTML_BYTES - 1))
        .send()
        .await
        .map_err(|_| "无法连接到这个网页".to_string())?;

    let final_url = validate_remote_url(response.url().as_str())?;
    if !response.status().is_success() {
        return Err(http_status_error(response.status().as_u16(), &final_url));
    }
    if let Some(content_type) = response.headers().get(CONTENT_TYPE) {
        let content_type = content_type
            .to_str()
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !content_type.contains("text/html") && !content_type.contains("application/xhtml+xml") {
            return Err("这个地址返回的不是网页内容".to_string());
        }
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_HTML_BYTES as u64)
    {
        return Err("网页内容过大，已跳过自动获取".to_string());
    }

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "读取网页内容失败".to_string())?
    {
        let remaining = MAX_HTML_BYTES.saturating_sub(bytes.len());
        bytes.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
        if bytes.len() == MAX_HTML_BYTES {
            break;
        }
    }

    let html = String::from_utf8_lossy(&bytes);
    Ok(FetchedPage {
        final_url: final_url.to_string(),
        metadata: parse_metadata(&html, &final_url),
        visible_text: visible_text(&html),
    })
}

fn http_status_error(status: u16, url: &Url) -> String {
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let site_name = if host == "zhihu.com" || host.ends_with(".zhihu.com") {
        "知乎"
    } else {
        "这个网站"
    };
    match status {
        401 | 403 => format!(
            "{site_name}限制了第三方自动读取（{status}），不是 AI 配置故障；仍可手动填写标题和简介后保存"
        ),
        429 => format!("{site_name}暂时限制了频繁访问（429），请稍后重试或手动填写"),
        _ => format!("网页暂时无法读取（状态码 {status}），仍可手动填写后保存"),
    }
}

fn validate_remote_url(input: &str) -> Result<Url, String> {
    let url = Url::parse(input.trim()).map_err(|_| "网页地址格式不正确".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("只支持 http 或 https 网页地址".to_string());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "网页地址缺少域名".to_string())?
        .trim_matches(['[', ']']);
    if host.eq_ignore_ascii_case("localhost") || host.to_ascii_lowercase().ends_with(".localhost") {
        return Err("不获取本机地址的网页信息".to_string());
    }
    if host.parse::<IpAddr>().is_ok_and(is_private_ip) {
        return Err("不获取局域网地址的网页信息".to_string());
    }
    Ok(url)
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_broadcast()
                || ip.is_unspecified()
                || ip.is_multicast()
        }
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.is_multicast()
        }
    }
}

fn parse_metadata(html: &str, base_url: &Url) -> BookmarkMetadata {
    let title = meta_content(html, "og:title")
        .or_else(|| meta_content(html, "twitter:title"))
        .or_else(|| title_text(html))
        .map(|value| clean_text(&value, 300))
        .filter(|value| !value.is_empty());
    let description = meta_content(html, "og:description")
        .or_else(|| meta_content(html, "description"))
        .or_else(|| meta_content(html, "twitter:description"))
        .map(|value| clean_text(&value, 800))
        .filter(|value| !value.is_empty());
    let favicon_url = favicon_href(html)
        .and_then(|href| base_url.join(&decode_entities(&href)).ok())
        .or_else(|| base_url.join("/favicon.ico").ok())
        .filter(|url| matches!(url.scheme(), "http" | "https"))
        .map(|url| url.to_string());

    BookmarkMetadata {
        title,
        description,
        favicon_url,
        ai_enhanced: false,
        warning: None,
    }
}

fn visible_text(html: &str) -> String {
    static HIDDEN_RE: OnceLock<Regex> = OnceLock::new();
    static TAG_RE: OnceLock<Regex> = OnceLock::new();
    let hidden_re = HIDDEN_RE.get_or_init(|| {
        Regex::new(
            r"(?is)<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>|<noscript\b[^>]*>.*?</noscript\s*>|<svg\b[^>]*>.*?</svg\s*>",
        )
        .unwrap()
    });
    let tag_re = TAG_RE.get_or_init(|| Regex::new(r"(?is)<[^>]+>").unwrap());
    decode_entities(&tag_re.replace_all(&hidden_re.replace_all(html, " "), " "))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(MAX_VISIBLE_TEXT_CHARS)
        .collect()
}

fn meta_content(html: &str, key: &str) -> Option<String> {
    static META_RE: OnceLock<Regex> = OnceLock::new();
    let meta_re = META_RE.get_or_init(|| Regex::new(r"(?is)<meta\b[^>]*>").unwrap());
    meta_re.find_iter(html).find_map(|tag| {
        let attributes = attributes(tag.as_str());
        let name = attributes
            .get("property")
            .or_else(|| attributes.get("name"))?
            .trim();
        name.eq_ignore_ascii_case(key)
            .then(|| attributes.get("content").cloned())
            .flatten()
    })
}

fn favicon_href(html: &str) -> Option<String> {
    static LINK_RE: OnceLock<Regex> = OnceLock::new();
    let link_re = LINK_RE.get_or_init(|| Regex::new(r"(?is)<link\b[^>]*>").unwrap());
    link_re.find_iter(html).find_map(|tag| {
        let attributes = attributes(tag.as_str());
        let rel = attributes.get("rel")?;
        rel.split_ascii_whitespace()
            .any(|value| value.to_ascii_lowercase().ends_with("icon"))
            .then(|| attributes.get("href").cloned())
            .flatten()
    })
}

fn title_text(html: &str) -> Option<String> {
    static TITLE_RE: OnceLock<Regex> = OnceLock::new();
    let title_re =
        TITLE_RE.get_or_init(|| Regex::new(r"(?is)<title\b[^>]*>(.*?)</title>").unwrap());
    title_re
        .captures(html)
        .and_then(|captures| captures.get(1))
        .map(|value| value.as_str().to_string())
}

fn attributes(tag: &str) -> HashMap<String, String> {
    static ATTRIBUTE_RE: OnceLock<Regex> = OnceLock::new();
    let attribute_re = ATTRIBUTE_RE.get_or_init(|| {
        Regex::new(r#"(?is)([a-z_:][a-z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))"#)
            .unwrap()
    });
    attribute_re
        .captures_iter(tag)
        .filter_map(|captures| {
            let name = captures.get(1)?.as_str().to_ascii_lowercase();
            let value = captures
                .get(2)
                .or_else(|| captures.get(3))
                .or_else(|| captures.get(4))?
                .as_str()
                .to_string();
            Some((name, value))
        })
        .collect()
}

fn clean_text(input: &str, max_chars: usize) -> String {
    static TAG_RE: OnceLock<Regex> = OnceLock::new();
    let tag_re = TAG_RE.get_or_init(|| Regex::new(r"(?is)<[^>]+>").unwrap());
    decode_entities(&tag_re.replace_all(input, " "))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max_chars)
        .collect()
}

fn decode_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_open_graph_metadata_and_resolves_favicon() {
        let html = r#"
            <html><head>
              <title>Fallback title</title>
              <meta content="A &amp; B" property="og:title">
              <meta name='description' content='Useful reference'>
              <link href="/assets/icon.png" rel="shortcut icon">
            </head></html>
        "#;
        let metadata = parse_metadata(html, &Url::parse("https://example.com/docs/page").unwrap());

        assert_eq!(metadata.title.as_deref(), Some("A & B"));
        assert_eq!(metadata.description.as_deref(), Some("Useful reference"));
        assert_eq!(
            metadata.favicon_url.as_deref(),
            Some("https://example.com/assets/icon.png")
        );
    }

    #[test]
    fn falls_back_to_the_sites_standard_favicon_path() {
        let metadata = parse_metadata(
            "<html><head><title>Example</title></head></html>",
            &Url::parse("https://example.com/docs").unwrap(),
        );
        assert_eq!(
            metadata.favicon_url.as_deref(),
            Some("https://example.com/favicon.ico")
        );
    }

    #[test]
    fn falls_back_to_clean_title_text() {
        let metadata = parse_metadata(
            "<title> Fangcun <strong>Docs</strong> </title>",
            &Url::parse("https://example.com").unwrap(),
        );

        assert_eq!(metadata.title.as_deref(), Some("Fangcun Docs"));
        assert_eq!(metadata.description, None);
        assert!(!metadata.ai_enhanced);
    }

    #[test]
    fn extracts_visible_text_without_scripts_or_styles() {
        let html = "<style>hidden css</style><h1>Useful title</h1><script>ignore me</script><p>A &amp; B</p>";
        assert_eq!(visible_text(html), "Useful title A & B");
    }

    #[test]
    fn rejects_local_and_private_addresses() {
        assert!(validate_remote_url("http://localhost:3000").is_err());
        assert!(validate_remote_url("http://127.0.0.1").is_err());
        assert!(validate_remote_url("http://192.168.1.2").is_err());
        assert!(validate_remote_url("https://example.com").is_ok());
    }

    #[test]
    fn explains_blocked_sites_without_blaming_ai_configuration() {
        let zhihu = Url::parse("https://zhuanlan.zhihu.com/p/525106459").unwrap();
        assert_eq!(
            http_status_error(403, &zhihu),
            "知乎限制了第三方自动读取（403），不是 AI 配置故障；仍可手动填写标题和简介后保存"
        );

        let generic = Url::parse("https://example.com/private").unwrap();
        assert_eq!(
            http_status_error(401, &generic),
            "这个网站限制了第三方自动读取（401），不是 AI 配置故障；仍可手动填写标题和简介后保存"
        );
    }
}
