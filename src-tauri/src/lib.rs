mod bookmark_metadata;
mod database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(database::sql_plugin().build())
        .invoke_handler(tauri::generate_handler![
            bookmark_metadata::fetch_bookmark_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fangcun");
}
