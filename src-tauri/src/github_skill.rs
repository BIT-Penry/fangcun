use reqwest::header::{ACCEPT, CONTENT_TYPE};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::Duration;

const MAX_SKILL_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubSkillSource {
    filename: String,
    local_path: String,
    preferred_skill_path: Option<String>,
}

#[derive(Deserialize)]
struct RepositoryMetadata {
    default_branch: String,
}

#[tauri::command]
pub async fn fetch_github_skill(url: String) -> Result<GithubSkillSource, String> {
    let source = parse_github_source(&url)?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(6))
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::limited(4))
        .user_agent("Fangcun/0.1 GitHub skill importer")
        .build()
        .map_err(|_| "无法初始化 GitHub 请求".to_string())?;

    let (download_url, filename, preferred_skill_path) = match source {
        GithubSource::Raw { url, filename } => (url, filename, None),
        GithubSource::Repository { owner, repo, branch, path } => {
            let branch = match branch {
                Some(value) => value,
                None => {
                    let metadata_url = format!("https://api.github.com/repos/{owner}/{repo}");
                    let response = client.get(metadata_url).header(ACCEPT, "application/vnd.github+json")
                        .send().await.map_err(|_| "无法连接 GitHub，请检查网络".to_string())?;
                    if !response.status().is_success() {
                        return Err(format!("GitHub 仓库无法访问（{}）", response.status().as_u16()));
                    }
                    response.json::<RepositoryMetadata>().await
                        .map_err(|_| "GitHub 仓库信息无法解析".to_string())?.default_branch
                }
            };
            let archive_url = Url::parse(&format!("https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}"))
                .map_err(|_| "GitHub 仓库地址无法解析".to_string())?;
            let preferred = path.map(|value| format!("{}/SKILL.md", value.trim_matches('/')));
            (archive_url, format!("{repo}.zip"), preferred)
        }
    };

    let response = client.get(download_url).header(ACCEPT, "application/octet-stream, text/plain")
        .send().await.map_err(|_| "无法下载 GitHub Skill，请检查网络".to_string())?;
    if !response.status().is_success() {
        return Err(format!("GitHub 内容无法下载（{}）", response.status().as_u16()));
    }
    if response.content_length().is_some_and(|length| length > MAX_SKILL_BYTES) {
        return Err("GitHub Skill 仓库超过 64 MB，请下载后从本地导入".to_string());
    }
    if let Some(content_type) = response.headers().get(CONTENT_TYPE) {
        let value = content_type.to_str().unwrap_or_default().to_ascii_lowercase();
        if value.contains("text/html") {
            return Err("GitHub 返回了网页而不是 Skill 文件，请检查链接".to_string());
        }
    }
    let bytes = response.bytes().await.map_err(|_| "GitHub Skill 下载不完整".to_string())?;
    if bytes.len() as u64 > MAX_SKILL_BYTES {
        return Err("GitHub Skill 仓库超过 64 MB，请下载后从本地导入".to_string());
    }
    let local_path = std::env::temp_dir().join(format!(
        "fangcun-github-skill-{}-{}",
        std::process::id(),
        filename.replace(|character: char| !character.is_ascii_alphanumeric() && character != '.', "-")
    ));
    fs::write(&local_path, &bytes).map_err(|_| "GitHub Skill 临时文件无法写入".to_string())?;
    Ok(GithubSkillSource {
        filename,
        local_path: local_path.to_string_lossy().into_owned(),
        preferred_skill_path,
    })
}

enum GithubSource {
    Raw { url: Url, filename: String },
    Repository { owner: String, repo: String, branch: Option<String>, path: Option<String> },
}

fn parse_github_source(input: &str) -> Result<GithubSource, String> {
    let url = Url::parse(input.trim()).map_err(|_| "请输入完整的 GitHub 链接".to_string())?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() || url.port().is_some() {
        return Err("只支持不含账号信息的 GitHub HTTPS 链接".to_string());
    }
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let segments = url.path_segments().map(|parts| parts.filter(|value| !value.is_empty()).map(str::to_string).collect::<Vec<_>>()).unwrap_or_default();
    if host == "raw.githubusercontent.com" {
        if segments.len() < 4 || !segments.last().is_some_and(|name| name.eq_ignore_ascii_case("SKILL.md")) {
            return Err("Raw 链接需要指向 SKILL.md".to_string());
        }
        return Ok(GithubSource::Raw { url, filename: "SKILL.md".to_string() });
    }
    if host != "github.com" || segments.len() < 2 {
        return Err("目前只支持 github.com 或 raw.githubusercontent.com".to_string());
    }
    let owner = segments[0].to_string();
    let repo = segments[1].trim_end_matches(".git").to_string();
    if segments.len() >= 5 && segments[2] == "blob" {
        if !segments.last().is_some_and(|name| name.eq_ignore_ascii_case("SKILL.md")) {
            return Err("GitHub 文件链接需要指向 SKILL.md".to_string());
        }
        let branch = &segments[3];
        let path = segments[4..].join("/");
        let raw = Url::parse(&format!("https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"))
            .map_err(|_| "GitHub 文件地址无法解析".to_string())?;
        return Ok(GithubSource::Raw { url: raw, filename: "SKILL.md".to_string() });
    }
    if segments.len() >= 5 && segments[2] == "tree" {
        return Ok(GithubSource::Repository {
            owner, repo, branch: Some(segments[3].to_string()), path: Some(segments[4..].join("/")),
        });
    }
    Ok(GithubSource::Repository { owner, repo, branch: None, path: None })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_repository_tree_and_raw_skill_links() {
        match parse_github_source("https://github.com/acme/skills/tree/main/paper-reader").unwrap() {
            GithubSource::Repository { owner, repo, branch, path } => {
                assert_eq!(owner, "acme"); assert_eq!(repo, "skills");
                assert_eq!(branch.as_deref(), Some("main")); assert_eq!(path.as_deref(), Some("paper-reader"));
            }
            _ => panic!("expected repository source"),
        }
        assert!(matches!(parse_github_source("https://raw.githubusercontent.com/acme/skills/main/SKILL.md").unwrap(), GithubSource::Raw { .. }));
    }

    #[test]
    fn rejects_non_github_and_non_skill_blob_links() {
        assert!(parse_github_source("https://example.com/SKILL.md").is_err());
        assert!(parse_github_source("https://github.com/acme/skills/blob/main/README.md").is_err());
    }
}
