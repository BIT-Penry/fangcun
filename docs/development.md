# Development

## Prerequisites

- macOS with Xcode Command Line Tools
- Node.js 22 (matches CI)
- pnpm 10 (matches CI)
- stable Rust toolchain

## Run

`pnpm install --frozen-lockfile`

`pnpm tauri dev`

`pnpm dev` starts only the frontend server. Database, Keychain, and native commands require the Tauri application.

## Validate

`pnpm test:run`

`pnpm typecheck`

`pnpm build`

`cargo check --locked --manifest-path src-tauri/Cargo.toml`

`cargo test --locked --manifest-path src-tauri/Cargo.toml`

CI runs frontend tests, type checking, the frontend build, `cargo check`, and Rust unit tests.

## Rust lockfile

`src-tauri/Cargo.lock` is committed. Use `--locked` in local and CI checks so dependency resolution stays reproducible.

## Package

`pnpm tauri build --bundles app,dmg`

The unsigned application and DMG are written under `src-tauri/target/release/bundle/`.

The default build targets the current Rust target architecture; it is not automatically a universal macOS build. Apple Silicon is the primary test environment. Intel Mac and other operating systems require separate build and installation validation.

The MVP intentionally does not include Apple Developer signing or notarization credentials. Before distributing outside local testing, configure Tauri's macOS signing identity and notarization environment, then rebuild on macOS. Unsigned builds may require the tester to confirm opening them in System Settings → Privacy & Security.

## Data migrations

SQLite migrations live in `src-tauri/migrations/` and are registered in `src-tauri/src/database.rs`. Never edit a migration that has shipped; add the next monotonically increasing migration instead.

Current schema versions:

- 1: settings
- 2–3: bookmarks and metadata
- 4: prompts and prompt tags
- 5–6: daily entries, moods, and Todo details
- 7: skill library
- 8: imported skill compatibility defaults

Development and installed builds with the same application identifier may access the same local data. Back up before testing imports, restores, deletion, or migrations, or use an isolated test account. Never commit your personal database as a fixture.

AI credentials are persisted in macOS Keychain and are not part of database backups. Do not include real API keys in logs or issues.

## Preparing a public test release

Collect dependency license files from the installed packages before building release assets:

```bash
node scripts/release-notices.mjs aarch64-apple-darwin
```

The generated `output/release/THIRD_PARTY_NOTICES.txt` contains the available license texts. Inspect `output/release/notice-review.json` for packages whose installed archive contains no license file; this collection is not a complete license audit. Resolve remaining notices before public distribution.

To include notices, remap personal compiler paths, and verify the ad-hoc signature:

```bash
node scripts/build-release-app.mjs
node scripts/package-release.mjs
```

These scripts currently target Apple Silicon macOS. The packager requires a clean committed checkout and creates ZIP/DMG, checksums, and build metadata in `output/release/`. The DMG uses a standard Applications shortcut, without Finder layout automation. A clean CI checkout should install with the frozen pnpm lockfile first.

For first-launch testing without touching the daily database, run `node scripts/build-release-app.mjs --smoke`. This uses `com.fangcun.release-smoke`; Keychain service identifiers remain unchanged, so do not change AI credentials during that test. Rebuild without `--smoke` for distribution. Upstream notice supplements and their pinned sources are documented in `docs/third-party/`.

- Commit the intended source version so the installer and release source match.
- Check source files, Git history, and bundled resources for credentials, personal data, and redistribution permissions.
- Select a project license and preserve required third-party notices.
- Run validation and test first launch, bookmark import, opening links, backup, and restore.
- Verify architecture compatibility, signing, and notarization on a tester's environment.
- Document installation, supported systems, known issues, changes, and feedback links in the Release.

This checklist describes preparation work, not completed release certification.
