// Build an ad-hoc signed macOS app without embedding the developer's home path.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smoke = process.argv.includes("--smoke");
if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error("This release script currently supports Apple Silicon macOS only.");
}
const review = JSON.parse(fs.readFileSync(path.join(root, "output/release/notice-review.json"), "utf8"));
if (!smoke && review.missingLicenseFiles.length) {
  throw new Error("Resolve missing third-party notices before building a release.");
}
const config = {
  ...(smoke ? { productName: "方寸发布验证", identifier: "com.fangcun.release-smoke" } : {}),
  build: { beforeBuildCommand: "npm run build" },
  bundle: {
    macOS: { signingIdentity: "-" },
    resources: {
      "../LICENSE": "LICENSE",
      "../output/release/THIRD_PARTY_NOTICES.txt": "THIRD_PARTY_NOTICES.txt",
    },
  },
};
// Encoded flags preserve paths containing spaces and avoid shell interpolation.
if (process.env.RUSTFLAGS && !process.env.CARGO_ENCODED_RUSTFLAGS) {
  throw new Error("Use CARGO_ENCODED_RUSTFLAGS instead of RUSTFLAGS for this build.");
}
const flags = [
  ...(process.env.CARGO_ENCODED_RUSTFLAGS?.split("\x1f") || []),
  `--remap-path-prefix=${os.homedir()}=/build`,
  `--remap-path-prefix=${root}=/src/fangcun`,
];
execFileSync("npm", ["run", "tauri", "--", "build", "--bundles", "app", "--config", JSON.stringify(config)], {
  cwd: root,
  env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: flags.join("\x1f") },
  stdio: "inherit",
});
const name = smoke ? "方寸发布验证" : "方寸";
const app = path.join(root, "src-tauri/target/release/bundle/macos", `${name}.app`);
execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], { stdio: "inherit" });
const binary = fs.readFileSync(path.join(app, "Contents/MacOS/fangcun"));
if (binary.includes(Buffer.from(os.homedir())) || binary.includes(Buffer.from(os.userInfo().username))) {
  throw new Error("Personal build path or username remains in the executable; do not distribute.");
}
console.log(`${smoke ? "Isolated smoke" : "Release"} app: signature and personal-path checks passed.`);
