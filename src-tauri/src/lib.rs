mod database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(database::sql_plugin().build())
        .run(tauri::generate_context!())
        .expect("error while running Fangcun");
}
