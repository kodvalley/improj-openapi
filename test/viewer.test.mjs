// The reference viewer must stay safe to host: no HTML injection sinks, no third-party origins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const js = await readFile(new URL("../docs/assets/viewer.js", import.meta.url), "utf8");
const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");

test("the viewer never writes HTML from the document", () => {
  for (const sink of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function"]) {
    assert.ok(!js.includes(sink), `viewer.js must not use ${sink}`);
  }
});

test("the page loads only same-origin resources under a strict CSP", () => {
  assert.match(html, /default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'/);
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(scripts, ['<script src="assets/viewer.js" defer>']);
  assert.ok(!/(src|href)="https?:/i.test(html), "no third-party resources");
});

test("links are restricted to fragments and https", () => {
  assert.match(js, /protocol === "https:"/);
  assert.ok(!/setAttribute\("href", (?!safeHref)/.test(js));
});
