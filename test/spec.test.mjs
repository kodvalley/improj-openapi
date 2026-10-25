// Contract invariants of the description, beyond what the ruleset checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const spec = JSON.parse(await readFile(new URL("../openapi/openapi.json", import.meta.url), "utf8"));
const METHODS = ["get", "post", "put", "patch", "delete"];
const ops = Object.entries(spec.paths).flatMap(([path, item]) =>
  METHODS.filter((m) => item[m]).map((m) => ({ path, method: m, op: item[m] })),
);

test("is OpenAPI 3.1 served over https only", () => {
  assert.match(spec.openapi, /^3\.1\./);
  assert.ok(spec.servers.length > 0);
  for (const s of spec.servers) assert.match(s.url, /^https:\/\//);
});

test("operationIds are unique", () => {
  const ids = ops.map((o) => o.op.operationId);
  assert.equal(new Set(ids).size, ids.length);
});

test("the bearer scheme is the only credential", () => {
  assert.deepEqual(Object.keys(spec.components.securitySchemes), ["bearerAuth"]);
  assert.equal(spec.components.securitySchemes.bearerAuth.type, "http");
  assert.equal(spec.components.securitySchemes.bearerAuth.scheme, "bearer");
});

test("only the document itself is public", () => {
  const publicOps = ops.filter((o) => Array.isArray(o.op.security) && o.op.security.length === 0).map((o) => o.op.operationId);
  assert.deepEqual(publicOps, ["getOpenApi"]);
});

test("every scope used by an operation is declared in x-scopes", () => {
  const declared = new Set(Object.keys(spec["x-scopes"]));
  for (const o of ops) if (o.op["x-required-scope"]) assert.ok(declared.has(o.op["x-required-scope"]), o.op.operationId);
});

test("creates answer 201 and deletes answer 204", () => {
  for (const o of ops) {
    if (o.method === "delete") assert.ok(o.op.responses["204"], o.op.operationId);
    if (/^create/.test(o.op.operationId)) assert.ok(o.op.responses["201"], o.op.operationId);
  }
});

test("webhook deliveries document the signature header", () => {
  for (const [name, hook] of Object.entries(spec.webhooks)) {
    const headers = hook.post.parameters.map((p) => p.name);
    assert.ok(headers.includes("IMPROJ-Signature"), name);
  }
});

test("the Problem schema carries the stable error fields", () => {
  const p = spec.components.schemas.Problem;
  for (const f of ["type", "title", "status", "detail", "instance", "code", "request_id"]) assert.ok(p.required.includes(f), f);
});
