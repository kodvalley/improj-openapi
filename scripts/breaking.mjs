// Fails when openapi/openapi.json has breaking changes against a base revision.
// Usage: node scripts/breaking.mjs [base-ref]   (default: $BASE_REF or origin/main)
// Needs the oasdiff binary on PATH (CI installs a pinned, checksum-verified release).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] ?? process.env.BASE_REF ?? "origin/main";
if (!/^[A-Za-z0-9._/-]+$/.test(base)) {
  console.error(`Refusing an unusual base ref: ${base}`);
  process.exit(2);
}

let previous;
try {
  previous = execFileSync("git", ["show", `${base}:openapi/openapi.json`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch {
  console.log(`No openapi/openapi.json at ${base}; nothing to compare.`);
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "improj-oasdiff-"));
const basePath = join(dir, "base.json");
writeFileSync(basePath, previous);
const run = spawnSync("oasdiff", ["breaking", basePath, "openapi/openapi.json", "--fail-on", "ERR", "--format", "text"], { stdio: "inherit" });
if (run.error) {
  console.error("oasdiff is not installed; see CONTRIBUTING.md.");
  process.exit(2);
}
process.exit(run.status ?? 1);
