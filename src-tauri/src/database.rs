use tauri_plugin_sql::{Migration, MigrationKind};

pub fn sql_plugin() -> tauri_plugin_sql::Builder {
    tauri_plugin_sql::Builder::default().add_migrations(
        "sqlite:fangcun.db",
        vec![
            Migration {
                version: 1,
                description: "create settings table",
                sql: include_str!("../migrations/0001_settings.sql"),
                kind: MigrationKind::Up,
            },
            Migration {
                version: 2,
                description: "create bookmark tables",
                sql: include_str!("../migrations/0002_bookmarks.sql"),
                kind: MigrationKind::Up,
            },
            Migration {
                version: 3,
                description: "add bookmark metadata",
                sql: include_str!("../migrations/0003_bookmark_metadata.sql"),
                kind: MigrationKind::Up,
            },
            Migration {
                version: 4,
                description: "create prompt tables",
                sql: include_str!("../migrations/0004_prompts.sql"),
                kind: MigrationKind::Up,
            },
            Migration {
                version: 5,
                description: "create journal tables",
                sql: include_str!("../migrations/0005_journal.sql"),
                kind: MigrationKind::Up,
            },
            Migration {
                version: 6,
                description: "add journal mood and todo details",
                sql: include_str!("../migrations/0006_journal_details.sql"),
                kind: MigrationKind::Up,
            },
        ],
    )
}
