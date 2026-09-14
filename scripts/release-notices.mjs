// Collect installed dependency notices for the release target without downloading packages.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "aarch64-apple-darwin";
const output = path.join(root, "output", "release");
fs.mkdirSync(output, { recursive: true });
const sections = ["Fangcun third-party notices", "Includes installed JavaScript dependencies and Cargo packages for " + target + ". Some build-time dependencies are included conservatively."];
const missing = [];
let count = 0;

function collect(name, directory, license, extraFile) {
  const files = new Set();
  function visit(dir, depth = 0) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isFile() && /^(licen[cs]e|copying|copyright|notice|ofl)([._-]|$)/i.test(item.name)) files.add(file);
      if (item.isDirectory() && depth < 2 && /^(licenses?|legal|third.party|fonts)$/i.test(item.name)) visit(file, depth + 1);
    }
  }
  visit(directory);
  if (extraFile && fs.existsSync(extraFile)) files.add(extraFile);
  sections.push(`\n${"=".repeat(72)}\n${name}\nDeclared license: ${license || "unspecified"}`);
  if (!files.size) missing.push(name);
  for (const file of [...files].sort()) sections.push(`\n--- ${path.relative(directory, file)} ---\n${fs.readFileSync(file, "utf8")}`);
  count++;
}

function resolvePackage(name, from) {
  let current = from;
  while (true) {
    const candidate = path.join(current, "node_modules", name, "package.json");
    if (fs.existsSync(candidate)) return fs.realpathSync(candidate);
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
const visited = new Set();
function walk(manifestPath) {
  if (visited.has(manifestPath)) return;
  visited.add(manifestPath);
  const pkg = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const directory = path.dirname(manifestPath);
  if (directory !== root) collect(`npm: ${pkg.name}@${pkg.version}`, directory, typeof pkg.license === "string" ? pkg.license : JSON.stringify(pkg.license));
  const optional = pkg.optionalDependencies || {};
  for (const name of Object.keys({ ...pkg.dependencies, ...optional })) {
    const child = resolvePackage(name, directory);
    if (child) walk(child);
    else if (!(name in optional)) throw new Error(`Missing installed dependency: ${name}`);
  }
}
walk(path.join(root, "package.json"));
const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--locked", "--offline", "--format-version", "1", "--filter-platform", target, "--manifest-path", path.join(root, "src-tauri/Cargo.toml")], { maxBuffer: 32 * 1024 * 1024 }).toString());
for (const pkg of metadata.packages.sort((a, b) => a.name.localeCompare(b.name))) {
  if (!pkg.source) continue;
  const directory = path.dirname(pkg.manifest_path);
  collect(`cargo: ${pkg.name}@${pkg.version}`, directory, pkg.license, pkg.license_file ? path.resolve(directory, pkg.license_file) : null);
}
fs.writeFileSync(path.join(output, "THIRD_PARTY_NOTICES.txt"), sections.join("\n") + "\n");
fs.writeFileSync(path.join(output, "notice-review.json"), JSON.stringify({ target, packages: count, missingLicenseFiles: missing }, null, 2) + "\n");
console.log(JSON.stringify({ packages: count, missingLicenseFiles: missing }, null, 2));
