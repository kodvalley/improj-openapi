// Proves the improj-* rules fire: a copy of the spec is broken on purpose and linted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const cli = join(root, "node_modules", "@stoplight", "spectral-cli", "dist", "index.js");

async function lint(spec) {
  const dir = await mkdtemp(join(tmpdir(), "improj-spectral-"));
  const file = join(dir, "openapi.json");
  await writeFile(file, JSON.stringify(spec));
  const args = [cli, "lint", file, "--ruleset", join(root, ".spectral.yaml"), "-f", "json", "--quiet"];
  try {
    const { stdout } = await run(process.execPath, args, { maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(stdout || "[]");
  } catch (e) {
    return JSON.parse(e.stdout || "[]");
  }
}

const original = JSON.parse(await readFile(join(root, "openapi", "openapi.json"), "utf8"));

test("the committed description has no rule errors", async () => {
  const results = await lint(original);
  assert.deepEqual(results.filter((r) => r.severity === 0).map((r) => r.code), []);
});

test("the improj rules catch broken conventions", async () => {
  const spec = structuredClone(original);
  spec.servers = [{ url: "http://improj.com/api/v1" }];
  const tasks = spec.paths["/projects/{project_id}/tasks"];
  tasks.post.parameters = tasks.post.parameters.filter((p) => !p.$ref);
  tasks.get.parameters.push({ name: "api_key", in: "query", schema: { type: "string" } });
  delete spec.paths["/projects/{project_id}/milestones"].get["x-required-scope"];
  const meetings = spec.paths["/projects/{project_id}/meetings"].get;
  meetings.parameters = meetings.parameters.filter((p) => p.name !== "cursor");
  spec.paths["/me"].get.responses["404"].content = { "application/json": { schema: {} } };
  spec.paths["/projects/{project_id}/WorkItems"] = spec.paths["/projects/{project_id}/work-packages"];
  spec.components.schemas.Task.properties.dueDate = { type: "string" };
  spec.paths["/me"].get.security = [{ cookieAuth: [] }];

  const codes = new Set((await lint(spec)).filter((r) => r.severity === 0).map((r) => r.code));
  for (const rule of [
    "improj-https-servers",
    "improj-post-idempotency-key",
    "improj-no-credentials-in-query",
    "improj-required-scope",
    "improj-list-pagination",
    "improj-errors-problem-json",
    "improj-path-kebab-case",
    "improj-properties-snake-case",
    "improj-bearer-only",
  ]) {
    assert.ok(codes.has(rule), `expected ${rule} to fire`);
  }
});
