mod ai_service;
mod bookmark_metadata;
mod database;
mod external_browser;
mod github_skill;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(database::sql_plugin().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            bookmark_metadata::fetch_bookmark_metadata,
            bookmark_metadata::fetch_ai_bookmark_metadata,
            bookmark_metadata::fetch_import_bookmark_metadata,
            ai_service::get_ai_service_config,
            ai_service::save_ai_service_config,
            ai_service::delete_ai_service_config,
            ai_service::format_prompt_content,
            ai_service::format_skill_content,
            ai_service::generate_skill_description,
            ai_service::generate_skill_tags,
            github_skill::fetch_github_skill,
            external_browser::open_url_with_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fangcun");
}
