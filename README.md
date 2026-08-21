# 方寸 · Fangcun

方寸是一款本地优先的个人桌面工作台，用于集中管理书签、提示词、每日待办和随笔记录。

## Status

Fangcun 0.1 is a complete local-first MVP for macOS. Core data stays in SQLite under the application data directory; no account, hosted service, telemetry, or Python runtime is required.

## MVP modules

- 首页
- 书签
- 提示词
- 日记
- 设置

## Features

- Save, edit, filter, tag, and open bookmarks; fetch page metadata with bounded network requests.
- Import Netscape Bookmark HTML with nested folders, duplicate preview, and invalid-link reporting.
- Create searchable prompt cards with independent tags, favorites, clipboard copy, and 500 ms autosave.
- Keep daily Markdown-compatible notes and ordered Todo lists, including completion and date migration.
- Use the Home page as a live view of today's journal data.
- Search bookmarks, prompts, journal entries, and Todo items with `Command + K`.
- Create versioned ZIP backups and restore them after an automatic safety snapshot.
- Switch between light, dark, and system themes.

## Keyboard shortcuts

- `Command + K`: global search
- `Command + N`: quick add for the current module

## Local data

On macOS, the database is stored under the app data directory for `com.fangcun.app`. The exact path is shown in Settings. Use Settings → Data & Backup before moving or replacing the database manually.

Fangcun stores core data locally and requires no account or hosted server.

## Development

See [docs/development.md](docs/development.md).

## Design

See [the MVP design specification](docs/superpowers/specs/2026-08-21-fangcun-design.md).
