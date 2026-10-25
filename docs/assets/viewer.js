/*
 * IMPROJ API reference viewer.
 *
 * A small, dependency-free renderer for openapi.json. It is served from the
 * same origin as the document and runs under a strict Content-Security-Policy
 * (no inline script, no third-party origins). Every piece of text from the
 * description is inserted with textContent, never as HTML, and only fragment
 * links (#...) or https: links are ever created.
 */
"use strict";

(() => {
  const METHODS = ["get", "post", "put", "patch", "delete"];
  const UNBOUNDED = 9007199254740991;
  const BASE_FALLBACK = "https://improj.com/api/v1";

  /* ---------- DOM helpers ---------- */

  /** Creates an element. `props` may hold className, id, text, href, and attributes in `attrs`. */
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      if (props.className) node.className = props.className;
      if (props.id) node.id = props.id;
      if (props.text != null) node.textContent = String(props.text);
      if (props.href) node.setAttribute("href", safeHref(props.href));
      if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  /** Only in-page fragments and https URLs are linkable. */
  function safeHref(href) {
    const s = String(href);
    if (/^#[A-Za-z0-9_.:-]*$/.test(s)) return s;
    try {
      const u = new URL(s);
      if (u.protocol === "https:") return u.href;
    } catch {
      /* not a URL */
    }
    return "#";
  }

  /** Renders `text` with `code` spans for backtick-quoted parts. */
  function prose(text, className) {
    const p = h("p", { className: className || "prose" });
    String(text || "")
      .split(/(`[^`]+`)/g)
      .forEach((part) => {
        if (/^`[^`]+`$/.test(part)) p.append(h("code", { text: part.slice(1, -1) }));
        else if (part) p.append(document.createTextNode(part));
      });
    return p;
  }

  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ---------- Schema helpers ---------- */

  let SPEC = null;

  function refName(ref) {
    const m = /^#\/components\/schemas\/([A-Za-z0-9_.-]+)$/.exec(String(ref || ""));
    return m ? m[1] : null;
  }

  function resolve(schema) {
    const name = schema && refName(schema.$ref);
    return name ? SPEC.components?.schemas?.[name] ?? {} : schema || {};
  }

  /** A one-line type label, with a link element for $ref targets. */
  function typeLabel(schema) {
    if (!schema || typeof schema !== "object") return h("span", { className: "type", text: "any" });
    const name = refName(schema.$ref);
    if (name) return h("a", { className: "type ref", href: `#schema-${name}`, text: name });
    const variants = schema.anyOf || schema.oneOf;
    if (Array.isArray(variants)) {
      const span = h("span", { className: "type" });
      variants.forEach((v, i) => {
        if (i) span.append(" | ");
        span.append(typeLabel(v));
      });
      return span;
    }
    if ("const" in schema) return h("span", { className: "type", text: JSON.stringify(schema.const) });
    const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    if (types.includes("array") || schema.items) {
      const span = h("span", { className: "type" }, "array<", typeLabel(schema.items), ">");
      if (types.includes("null")) span.append(" | null");
      return span;
    }
    let label = types.length ? types.join(" | ") : Object.keys(schema).length ? "object" : "any";
    if (schema.format) label += ` (${schema.format})`;
    return h("span", { className: "type", text: label });
  }

  /** Constraint notes (bounds that only restate the integer range are left out). */
  function constraints(schema) {
    const s = schema || {};
    const notes = [];
    if (Array.isArray(s.enum)) notes.push(`one of: ${s.enum.join(", ")}`);
    if (s.minLength != null) notes.push(`min length ${s.minLength}`);
    if (s.maxLength != null) notes.push(`max length ${s.maxLength}`);
    if (s.minItems != null) notes.push(`min items ${s.minItems}`);
    if (s.maxItems != null) notes.push(`max items ${s.maxItems}`);
    if (s.minimum != null && Math.abs(s.minimum) < UNBOUNDED) notes.push(`min ${s.minimum}`);
    if (s.exclusiveMinimum != null) notes.push(`greater than ${s.exclusiveMinimum}`);
    if (s.maximum != null && Math.abs(s.maximum) < UNBOUNDED) notes.push(`max ${s.maximum}`);
    if (s.pattern) notes.push(`pattern ${s.pattern}`);
    if (s.default !== undefined) notes.push(`default ${JSON.stringify(s.default)}`);
    return notes;
  }

  /** The object schema to expand for a property, if any (refs are linked, not expanded). */
  function innerObject(schema) {
    if (!schema || schema.$ref) return null;
    const variants = schema.anyOf || schema.oneOf;
    if (Array.isArray(variants)) {
      const objs = variants.filter((v) => v && !v.$ref && v.properties);
      return objs.length === 1 ? objs[0] : null;
    }
    if (schema.properties) return schema;
    if (schema.items && !schema.items.$ref && schema.items.properties) return schema.items;
    return null;
  }

  /** A table of an object's properties, nested objects expanded up to `depth`. */
  function propertiesTable(schema, depth = 0) {
    const s = resolve(schema);
    const props = s.properties || {};
    const required = new Set(s.required || []);
    const names = Object.keys(props);
    if (!names.length) {
      const free = s.additionalProperties !== undefined && s.additionalProperties !== false;
      return h("p", { className: "muted", text: free ? "A JSON object (free-form)." : "No fields." });
    }
    const body = h("tbody");
    for (const name of names) {
      const p = props[name];
      const notes = constraints(p);
      const descCell = h("td");
      if (p.description) descCell.append(prose(p.description));
      if (notes.length) descCell.append(h("p", { className: "muted", text: notes.join("; ") }));
      body.append(
        h(
          "tr",
          null,
          h("td", null, h("code", { text: name }), required.has(name) ? h("span", { className: "req", text: "required" }) : null),
          h("td", null, typeLabel(p)),
          descCell,
        ),
      );
      const inner = innerObject(p);
      if (inner && depth < 3) {
        body.append(h("tr", { className: "nested" }, h("td", { attrs: { colspan: 3 } }, propertiesTable(inner, depth + 1))));
      }
    }
    return h("table", { className: "props" }, h("thead", null, h("tr", null, h("th", { text: "Field" }), h("th", { text: "Type" }), h("th", { text: "Notes" }))), body);
  }

  /** A minimal example value built from the schema (required fields only). */
  function example(schema, depth = 0) {
    const s = resolve(schema);
    if (depth > 4) return null;
    if (s.const !== undefined) return s.const;
    if (Array.isArray(s.enum)) return s.enum[0];
    const variants = s.anyOf || s.oneOf;
    if (Array.isArray(variants)) return example(variants.find((v) => v.type !== "null") || variants[0], depth + 1);
    const t = Array.isArray(s.type) ? s.type.find((x) => x !== "null") : s.type;
    if (t === "object" || s.properties) {
      const out = {};
      for (const name of s.required || []) out[name] = example(s.properties?.[name], depth + 1);
      return out;
    }
    if (t === "array") return [];
    if (t === "integer" || t === "number") return s.minimum && s.minimum > 0 ? s.minimum : 1;
    if (t === "boolean") return true;
    if (s.pattern === "^\\d{4}-\\d{2}-\\d{2}$") return "2026-11-02";
    if (s.pattern && s.pattern.startsWith("^([01]")) return "09:30";
    return "string";
  }

  /* ---------- Rendering ---------- */

  function operations() {
    const out = [];
    for (const [path, item] of Object.entries(SPEC.paths || {})) {
      for (const m of METHODS) {
        const op = item[m];
        if (op) out.push({ path, method: m, op, tag: (op.tags && op.tags[0]) || "Other" });
      }
    }
    return out;
  }

  function curlFor(o, base) {
    const lines = [`curl -sS -X ${o.method.toUpperCase()} "${base}${o.path.replace(/\{(\w+)\}/g, (_, n) => `<${n}>`)}"`];
    if ((o.op.security || SPEC.security || []).length) lines.push(`  -H "Authorization: Bearer $IMPROJ_TOKEN"`);
    lines.push(`  -H "IMPROJ-API-Version: ${SPEC.info?.version ?? ""}"`);
    const json = o.op.requestBody?.content?.["application/json"];
    const raw = o.op.requestBody?.content?.["application/octet-stream"];
    if (o.method === "post") lines.push(`  -H "Idempotency-Key: $(uuidgen)"`);
    if (json) {
      lines.push(`  -H "Content-Type: application/json"`);
      lines.push(`  --data '${JSON.stringify(example(json.schema))}'`);
    } else if (raw) {
      lines.push(`  -H "Content-Type: application/octet-stream"`);
      lines.push(`  --data-binary @./file.pdf`);
    }
    return lines.join(" \\\n");
  }

  function paramsTable(params) {
    const body = h("tbody");
    for (const raw of params) {
      const p = component(raw, "parameters");
      const notes = constraints(p.schema);
      const desc = h("td");
      if (p.description) desc.append(prose(p.description));
      if (notes.length) desc.append(h("p", { className: "muted", text: notes.join("; ") }));
      body.append(
        h(
          "tr",
          null,
          h("td", null, h("code", { text: p.name }), p.required ? h("span", { className: "req", text: "required" }) : null),
          h("td", { text: p.in }),
          h("td", null, typeLabel(p.schema)),
          desc,
        ),
      );
    }
    return h("table", { className: "props" }, h("thead", null, h("tr", null, h("th", { text: "Name" }), h("th", { text: "In" }), h("th", { text: "Type" }), h("th", { text: "Notes" }))), body);
  }

  /** Follows a local $ref into components (responses, headers, parameters). */
  function component(obj, kind) {
    const m = obj && typeof obj.$ref === "string" ? new RegExp("^#/components/" + kind + "/([^/]+)$").exec(obj.$ref) : null;
    return m ? SPEC.components?.[kind]?.[m[1]] ?? {} : obj || {};
  }

  function responseBlock(code, raw) {
    const res = component(raw, "responses");
    const box = h("div", { className: `response r${String(code)[0]}` });
    box.append(h("h5", null, h("span", { className: "code", text: code }), " ", res.description || ""));
    const headers = Object.keys(res.headers || {});
    if (headers.length) box.append(h("p", { className: "muted", text: `Headers: ${headers.join(", ")}` }));
    for (const [type, media] of Object.entries(res.content || {})) {
      box.append(h("p", { className: "muted" }, "Content-Type ", h("code", { text: type })));
      if (media.schema) box.append(propertiesTable(media.schema));
    }
    return box;
  }

  function operationSection(o, base) {
    const id = `op-${o.op.operationId || slug(o.method + o.path)}`;
    const sec = h("section", { className: "op", id, attrs: { "data-search": `${o.method} ${o.path} ${o.op.summary || ""} ${o.op.operationId || ""}`.toLowerCase() } });
    sec.append(h("h3", null, h("span", { className: `method m-${o.method}`, text: o.method.toUpperCase() }), " ", h("code", { className: "path", text: o.path })));
    if (o.op.summary) sec.append(h("p", { className: "summary", text: o.op.summary }));
    const scope = o.op["x-required-scope"];
    const meta = h("p", { className: "meta" });
    meta.append(h("span", { className: "muted", text: "operationId " }), h("code", { text: o.op.operationId || "-" }));
    if (scope) meta.append("  ", h("span", { className: "muted", text: "scope " }), h("code", { className: "scope", text: scope }));
    if (Array.isArray(o.op.security) && o.op.security.length === 0) meta.append("  ", h("span", { className: "pill", text: "public" }));
    sec.append(meta);
    if (o.op.description) sec.append(prose(o.op.description));
    if (o.op.parameters?.length) sec.append(h("h4", { text: "Parameters" }), paramsTable(o.op.parameters));
    const rb = o.op.requestBody;
    if (rb) {
      sec.append(h("h4", { text: "Request body" }));
      if (rb.description) sec.append(prose(rb.description));
      for (const [type, media] of Object.entries(rb.content || {})) {
        sec.append(h("p", { className: "muted" }, "Content-Type ", h("code", { text: type })));
        if (type === "application/json" && media.schema) sec.append(propertiesTable(media.schema));
      }
    }
    sec.append(h("h4", { text: "Responses" }));
    for (const [code, res] of Object.entries(o.op.responses || {})) sec.append(responseBlock(code, res));
    sec.append(h("h4", { text: "Example" }), h("pre", { className: "code" }, h("code", { text: curlFor(o, base) })));
    return sec;
  }

  const GUIDES = [
    ["Authentication", [
      "Send a personal access token (improj_pat_...) or an organisation token (improj_org_...) in the `Authorization: Bearer <token>` header. Never put a token in a URL; the API refuses tokens in the query string and ignores cookies.",
      "Every request acts as the token's owner, with the owner's permissions narrowed by the token's scopes, project list, IP allow-list and browser origins. Keep tokens on servers; see the security model.",
    ]],
    ["Versioning", [
      "Responses carry `IMPROJ-API-Version`. Pin a version by sending the same header; an unknown value is refused with 400 `API_VERSION_UNSUPPORTED`. Additive changes ship in v1, so ignore fields you do not know.",
    ]],
    ["Errors", [
      "Errors are `application/problem+json` with `type`, `title`, `status`, `detail`, `instance`, a stable `code`, `request_id` and, for invalid input, `errors[]` of `{path, message}`. Quote the `X-Request-Id` header when you contact support.",
      "A resource you may not see answers 404, exactly like one that does not exist.",
    ]],
    ["Pagination", [
      "Lists answer `{ data: [...], next_cursor }`. Pass `?limit=1..100` and the previous `next_cursor` as `?cursor=` until it is null. Cursors are opaque and signed; do not build or edit them.",
    ]],
    ["Idempotency", [
      "Send `Idempotency-Key` (1 to 255 visible ASCII characters) on POST. Repeating the same request with the same key within 24 hours replays the first answer with `Idempotent-Replayed: true`. The same key with a different request is 422; a request still running with that key is 409.",
    ]],
    ["Rate limits", [
      "Per token and minute: 300 requests, of which 60 writes and 30 uploads; 600 per client address. Every answer carries `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `RateLimit-Policy`; a 429 carries `Retry-After` (seconds).",
    ]],
    ["Uploads", [
      "Step 1: `POST /projects/{project_id}/uploads` with `{name, size, mime_type, parent_id?}` answers `{id, upload_url, method: \"PUT\", max_bytes, expires_at}`. Step 2: `PUT` the bytes to the upload URL with the same bearer token, `Content-Type: application/octet-stream` and a `Content-Length` equal to the announced size. Upload ids are single use and expire after 15 minutes.",
    ]],
    ["Webhook signatures", [
      "Each delivery is signed: `IMPROJ-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, \"<t>.\" + raw body)>`. Compute the HMAC over the raw request bytes, compare in constant time, and refuse timestamps more than 300 seconds away. Other headers: `IMPROJ-Event`, `IMPROJ-Delivery`, `IMPROJ-Webhook-Id`, `IMPROJ-API-Version`.",
      "The body is thin (ids only): fetch the object through the API to read it, which also re-applies your current permissions.",
    ]],
  ];

  function render(spec) {
    SPEC = spec;
    const nav = document.getElementById("nav");
    const main = document.getElementById("main");
    const base = (spec.servers && spec.servers[0] && spec.servers[0].url) || BASE_FALLBACK;
    document.getElementById("version").textContent = spec.info?.version ?? "";
    main.replaceChildren();

    // Overview and guides.
    const intro = h("section", { id: "overview", className: "intro" });
    intro.append(h("h1", { text: spec.info?.title || "API" }));
    if (spec.info?.description) intro.append(prose(spec.info.description));
    intro.append(h("p", null, h("span", { className: "muted", text: "Base URL " }), h("code", { text: base })));
    main.append(intro);
    const navList = h("ul");
    navList.append(h("li", null, h("a", { href: "#overview", text: "Overview" })));
    for (const [title, paras] of GUIDES) {
      const id = `guide-${slug(title)}`;
      const sec = h("section", { id, className: "guide" }, h("h2", { text: title }));
      paras.forEach((t) => sec.append(prose(t)));
      main.append(sec);
      navList.append(h("li", null, h("a", { href: `#${id}`, text: title })));
    }

    // Scopes.
    const scopes = spec["x-scopes"] || {};
    if (Object.keys(scopes).length) {
      const body = h("tbody");
      for (const [name, info] of Object.entries(scopes)) {
        body.append(h("tr", null, h("td", null, h("code", { text: name })), h("td", { text: info.write ? "write" : "read" }), h("td", { text: info.description || "" })));
      }
      main.append(h("section", { id: "scopes" }, h("h2", { text: "Scopes" }), h("table", { className: "props" }, h("thead", null, h("tr", null, h("th", { text: "Scope" }), h("th", { text: "Kind" }), h("th", { text: "Grants" }))), body)));
      navList.append(h("li", null, h("a", { href: "#scopes", text: "Scopes" })));
    }
    nav.replaceChildren(h("h2", { className: "navhead", text: "Guides" }), navList);

    // Endpoints by tag.
    const byTag = new Map();
    for (const t of spec.tags || []) byTag.set(t.name, []);
    for (const o of operations()) {
      if (!byTag.has(o.tag)) byTag.set(o.tag, []);
      byTag.get(o.tag).push(o);
    }
    for (const [tag, ops] of byTag) {
      if (!ops.length) continue;
      const tagId = `tag-${slug(tag)}`;
      const sec = h("section", { id: tagId, className: "tag" }, h("h2", { text: tag }));
      const tagNav = h("ul", { className: "ops" });
      for (const o of ops) {
        const s = operationSection(o, base);
        sec.append(s);
        tagNav.append(h("li", { attrs: { "data-search": s.getAttribute("data-search") } }, h("a", { href: `#${s.id}` }, h("span", { className: `method m-${o.method}`, text: o.method.toUpperCase() }), " ", o.op.summary || o.path)));
      }
      main.append(sec);
      nav.append(h("h2", { className: "navhead" }, h("a", { href: `#${tagId}`, text: tag })), tagNav);
    }

    // Webhooks.
    const hooks = Object.keys(spec.webhooks || {});
    if (hooks.length) {
      const sec = h("section", { id: "webhooks-events", className: "tag" }, h("h2", { text: "Webhook events" }));
      sec.append(prose("Your endpoint receives a POST for each subscribed event. Answer any 2xx quickly; anything else is retried with backoff (1 min, 5 min, 30 min, 2 h, 6 h, 12 h)."));
      sec.append(h("ul", { className: "events" }, ...hooks.map((e) => h("li", null, h("code", { text: e })))));
      const first = spec.webhooks[hooks[0]].post;
      if (first?.parameters) sec.append(h("h4", { text: "Headers" }), paramsTable(first.parameters));
      const payload = first?.requestBody?.content?.["application/json"]?.schema;
      if (payload) sec.append(h("h4", { text: "Payload" }), propertiesTable(payload));
      main.append(sec);
      nav.append(h("h2", { className: "navhead" }, h("a", { href: "#webhooks-events", text: "Webhook events" })));
    }

    // Schemas.
    const schemas = spec.components?.schemas || {};
    const schemaSec = h("section", { id: "schemas", className: "tag" }, h("h2", { text: "Schemas" }));
    const schemaNav = h("ul", { className: "ops" });
    for (const [name, schema] of Object.entries(schemas)) {
      const id = `schema-${name}`;
      schemaSec.append(h("section", { id, className: "schema", attrs: { "data-search": `schema ${name}`.toLowerCase() } }, h("h3", null, h("code", { text: name })), schema.description ? prose(schema.description) : null, propertiesTable(schema)));
      schemaNav.append(h("li", { attrs: { "data-search": `schema ${name}`.toLowerCase() } }, h("a", { href: `#${id}`, text: name })));
    }
    main.append(schemaSec);
    nav.append(h("h2", { className: "navhead" }, h("a", { href: "#schemas", text: "Schemas" })), schemaNav);

    // Filter.
    const filter = document.getElementById("filter");
    filter.addEventListener("input", () => {
      const q = filter.value.trim().toLowerCase();
      document.querySelectorAll("[data-search]").forEach((node) => {
        node.hidden = q !== "" && !node.getAttribute("data-search").includes(q);
      });
    });

    // Honour a fragment that pointed into the rendered content.
    if (location.hash.length > 1) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  function fail(message) {
    const status = document.getElementById("status");
    if (status) {
      status.textContent = message;
      status.classList.add("error");
    }
  }

  fetch("openapi.json", { credentials: "omit", cache: "no-cache", headers: { Accept: "application/json" } })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((spec) => {
      if (!spec || typeof spec !== "object" || !String(spec.openapi || "").startsWith("3.")) throw new Error("not an OpenAPI 3 document");
      render(spec);
    })
    .catch((e) => fail(`Could not load openapi.json (${e.message}).`));
})();
