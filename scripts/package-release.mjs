// Package only the final app; never copy a user's installed app or data directory.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (command, args) => execFileSync(command, args, { cwd: root, encoding: "utf8" });
if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("Apple Silicon macOS is required.");
if (run("git", ["status", "--porcelain"]).trim()) throw new Error("Commit source changes before packaging.");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const app = path.join(root, "src-tauri/target/release/bundle/macos/方寸.app");
const output = path.join(root, "output/release");
const plist = path.join(app, "Contents/Info.plist");
if (run("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", plist]).trim() !== "com.fangcun.app") throw new Error("Not the distribution app.");
run("codesign", ["--verify", "--deep", "--strict", app]);
const executable = fs.readFileSync(path.join(app, "Contents/MacOS/fangcun"));
for (const value of [os.homedir(), os.userInfo().username]) {
  if (executable.includes(Buffer.from(value))) throw new Error("Personal build path remains; rebuild with build-release-app.mjs.");
}
const notices = fs.readFileSync(path.join(output, "THIRD_PARTY_NOTICES.txt"));
if (!notices.equals(fs.readFileSync(path.join(app, "Contents/Resources/THIRD_PARTY_NOTICES.txt")))) throw new Error("Bundled notices are stale.");
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "fangcun-release-"));
run("ditto", [app, path.join(stage, "方寸.app")]);
fs.symlinkSync("/Applications", path.join(stage, "Applications"));
const prefix = `Fangcun_${version}_aarch64`;
const zip = `${prefix}.app.zip`;
const dmg = `${prefix}.dmg`;
run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", app, path.join(output, zip)]);
run("hdiutil", ["create", "-ov", "-volname", `方寸 ${version}`, "-srcfolder", stage, "-format", "UDZO", path.join(output, dmg)]);
run("hdiutil", ["verify", path.join(output, dmg)]);
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
fs.writeFileSync(path.join(output, "BUILD_INFO.json"), JSON.stringify({
  version,
  sourceCommit: run("git", ["rev-parse", "HEAD"]).trim(),
  repository: "https://github.com/BIT-Penry/fangcun",
  target: "aarch64-apple-darwin",
  buildHostMacOS: run("sw_vers", ["-productVersion"]).trim(),
  signing: "ad-hoc",
  notarized: false,
  applicationSignatureVerified: true,
  dmgChecksumVerified: true,
  personalBuildPathScanPassed: true,
  executableSha256: crypto.createHash("sha256").update(executable).digest("hex"),
  validationScope: "See docs/releases/v0.1.0-beta.1.md; packaging checks do not imply runtime or legal certification.",
}, null, 2) + "\n");
const assets = [zip, dmg, "THIRD_PARTY_NOTICES.txt", "notice-review.json", "BUILD_INFO.json"];
fs.writeFileSync(path.join(output, "SHA256SUMS.txt"), assets.map((name) => `${hash(path.join(output, name))}  ${name}`).join("\n") + "\n");
console.log(`Created ${zip}, ${dmg}, checksums and build metadata. Staging directory retained: ${stage}`);
