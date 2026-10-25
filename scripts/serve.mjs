// Serves site/ on http://127.0.0.1:8080 for local preview (loopback only, GET only).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(fileURLToPath(new URL("../site/", import.meta.url)));
const rootPrefix = root.endsWith(sep) ? root : root + sep;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};
const port = Number(process.env.PORT ?? 8080);

createServer(async (req, res) => {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const file = normalize(rootPrefix + (path.endsWith("/") ? `${path}index.html` : path));
  if (req.method !== "GET" || !file.startsWith(rootPrefix)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => console.log(`Serving site/ at http://127.0.0.1:${port}/`));
