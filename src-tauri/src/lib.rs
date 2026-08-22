mod bookmark_metadata;
mod database;
mod deepseek;
mod external_browser;

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
            deepseek::get_deepseek_status,
            deepseek::save_deepseek_api_key,
            deepseek::delete_deepseek_api_key,
            external_browser::open_url_with_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fangcun");
}
