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

`pnpm tauri build --bundles app`

The unsigned application is written under `src-tauri/target/release/bundle/macos/`.
