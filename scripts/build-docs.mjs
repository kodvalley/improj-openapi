// Builds the static reference site into site/: the viewer plus a copy of the spec.
import { cp, mkdir, rm } from "node:fs/promises";

const out = new URL("../site/", import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(new URL("../docs/index.html", import.meta.url), new URL("index.html", out));
await cp(new URL("../docs/assets/", import.meta.url), new URL("assets/", out), { recursive: true });
await cp(new URL("../openapi/openapi.json", import.meta.url), new URL("openapi.json", out));
console.log("Built site/ (index.html, assets/, openapi.json)");
