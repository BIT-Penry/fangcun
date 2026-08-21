use tauri_plugin_sql::{Migration, MigrationKind};

pub fn sql_plugin() -> tauri_plugin_sql::Builder {
    tauri_plugin_sql::Builder::default().add_migrations(
        "sqlite:fangcun.db",
        vec![Migration {
            version: 1,
            description: "create settings table",
            sql: include_str!("../migrations/0001_settings.sql"),
            kind: MigrationKind::Up,
        }],
    )
}
