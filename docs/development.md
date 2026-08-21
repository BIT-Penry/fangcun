# Development

## Prerequisites

- macOS with Xcode Command Line Tools
- Node.js LTS
- pnpm
- stable Rust toolchain

## Run

`pnpm install`

`pnpm tauri dev`

## Validate

`pnpm test:run`

`pnpm typecheck`

`pnpm build`

`cargo check --locked --manifest-path src-tauri/Cargo.toml`

## Rust lockfile

`src-tauri/Cargo.lock` is committed. Use `--locked` in local and CI checks so dependency resolution stays reproducible.

## Package

`pnpm tauri build --bundles app,dmg`

The unsigned application and DMG are written under `src-tauri/target/release/bundle/`.

The MVP intentionally does not include Apple Developer signing or notarization credentials. Before distributing outside local testing, configure Tauri's macOS signing identity and notarization environment, then rebuild on macOS. Unsigned builds may require the tester to confirm opening them in System Settings → Privacy & Security.

## Data migrations

SQLite migrations live in `src-tauri/migrations/` and are registered in `src-tauri/src/database.rs`. Never edit a migration that has shipped; add the next monotonically increasing migration instead.

Current schema versions:

- 1: settings
- 2–3: bookmarks and metadata
- 4: prompts and prompt tags
- 5: daily entries and Todo items
