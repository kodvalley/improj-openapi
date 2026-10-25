# IMPROJ OpenAPI

[![CI](https://github.com/kodvalley/improj-openapi/actions/workflows/ci.yml/badge.svg)](https://github.com/kodvalley/improj-openapi/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/kodvalley/improj-openapi/badge)](https://scorecard.dev/viewer/?uri=github.com/kodvalley/improj-openapi)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-6ba539)](openapi/openapi.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

The machine-readable contract of the **IMPROJ public REST API v1** (`https://improj.com/api/v1`), a self-hosted reference site, and the checks that keep the contract consistent.

| Path | What it is |
|---|---|
| [`openapi/openapi.json`](openapi/openapi.json) | OpenAPI 3.1 description, API version `2026-10-24` |
| [`docs/`](docs/) | Reference viewer (no third-party scripts) and guides |
| [`docs/STYLE_GUIDE.md`](docs/STYLE_GUIDE.md) | The conventions every endpoint follows |
| [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md) | Authentication, authorisation, limits and webhook security |
| [`.spectral.yaml`](.spectral.yaml) | Lint ruleset (Spectral `oas` rules plus IMPROJ rules) |
| [`CHANGELOG.md`](CHANGELOG.md) | Changes per API version |

Official SDKs: [improj-js](https://github.com/kodvalley/improj-js) (`@kodvalley/improj`), [improj-react](https://github.com/kodvalley/improj-react) (`@kodvalley/improj-react`), [improj-php](https://github.com/kodvalley/improj-php) (`kodvalley/improj-php`). Runnable samples: [improj-examples](https://github.com/kodvalley/improj-examples).

## Install and use the description

Download `openapi/openapi.json` from a tagged [release](https://github.com/kodvalley/improj-openapi/releases) (each release ships a `SHA256SUMS` file) or fetch the live copy from `https://improj.com/api/v1/openapi.json`. Feed it to your client generator, mock server or API gateway.

```sh
curl -fsSL https://improj.com/api/v1/openapi.json -o improj-openapi.json
```

## Quick start

```sh
export IMPROJ_TOKEN="improj_pat_..."   # Settings > Developers in IMPROJ; keep it on the server

curl -sS https://improj.com/api/v1/projects \
  -H "Authorization: Bearer $IMPROJ_TOKEN" \
  -H "IMPROJ-API-Version: 2026-10-24"
```

## Authentication

Every request carries `Authorization: Bearer <token>`:

- `improj_pat_...`: a personal access token, acting as you.
- `improj_org_...`: an organisation token, acting as the organisation owner or admin who created it, limited to that organisation's projects.

A token's scopes, optional project list, IP allow-list, browser origins and expiry only ever **narrow** what its owner may do in the app. Tokens in a URL are refused, and cookies are ignored. See the [security model](docs/SECURITY_MODEL.md).

## Versioning

The path carries the major version (`/api/v1`). Every response carries `IMPROJ-API-Version: 2026-10-24`. Send the same header to pin the version you tested against; an unknown value is refused with `400 API_VERSION_UNSUPPORTED`. Additive changes (new fields, endpoints, events) ship inside v1, so **clients must ignore fields they do not know**. Breaking changes need `/api/v2`; CI enforces this with [oasdiff](https://github.com/oasdiff/oasdiff).

## Errors

Errors are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) `application/problem+json`:

```json
{
  "type": "https://improj.com/developers#error-INVALID_INPUT",
  "title": "Bad Request",
  "status": 400,
  "detail": "Some of the values entered are not valid. Check them and try again.",
  "instance": "/api/v1/projects/42/tasks",
  "code": "INVALID_INPUT",
  "request_id": "req_6f1c...",
  "errors": [{ "path": "due_date", "message": "Use YYYY-MM-DD" }]
}
```

Branch on `code`, not on `detail`. Codes you will meet most often:

| Status | Code | Meaning |
|---|---|---|
| 400 | `INVALID_INPUT` | A field is missing, malformed or unknown; see `errors[]` |
| 400 | `API_VERSION_UNSUPPORTED` | The `IMPROJ-API-Version` you sent is not served |
| 400 | `API_CURSOR_INVALID` | The cursor was edited or belongs to another list, token or filter |
| 401 | `API_TOKEN_MISSING`, `API_TOKEN_INVALID` | No token, or not valid, expired or revoked |
| 403 | `API_SCOPE_MISSING` | The token lacks the operation's scope |
| 403 | `API_IP_NOT_ALLOWED`, `API_ORIGIN_NOT_ALLOWED` | Outside the token's IP allow-list or browser origins |
| 403 | `API_NOT_IN_PLAN`, `API_DISABLED` | The plan has no API access, or the API is switched off |
| 403 | `VIEWER_READ_ONLY`, `PROJECT_ARCHIVED_READ_ONLY` | The app refuses this change |
| 404 | `NOT_FOUND`, `API_UPLOAD_EXPIRED` | Missing or not visible; upload id used or expired |
| 409 | `IDEMPOTENCY_KEY_IN_USE` | The first request with this key is still running |
| 413 | `API_PAYLOAD_TOO_LARGE` | Body over 256 KB |
| 415 | `API_UNSUPPORTED_MEDIA_TYPE` | Wrong `Content-Type` |
| 422 | `IDEMPOTENCY_KEY_REUSED` | The key was used for a different request |
| 429 | `RATE_LIMITED` | Wait `Retry-After` seconds |
| 503 | `DB_UNAVAILABLE`, `SERVER_BUSY` | Temporary; retry with backoff |

Quote `request_id` (also in the `X-Request-Id` header) when you contact support. A resource you may not see is `404`, exactly like one that does not exist.

## Pagination

Lists answer `{ "data": [...], "next_cursor": "..." | null }`. Pass `?limit=1..100` (default 25) and the previous `next_cursor` as `?cursor=` until it is `null`. Cursors are opaque and signed; never build or edit one.

## Idempotency and retries

Send an `Idempotency-Key` (1 to 255 visible ASCII characters, for example a UUID) on every POST. Within 24 hours the same key and the same request replay the first answer with `Idempotent-Replayed: true`; the same key with a different request is `422`, and a request still running with that key is `409`. Retry only idempotent requests, and on `429` or `503` wait for `Retry-After` seconds.

## Rate limits

Per token and minute: 300 requests, of which 60 writes and 30 uploads; per client address 600. Every answer carries `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `RateLimit-Policy`.

## Uploads

1. `POST /projects/{project_id}/uploads` with `{ name, size, mime_type, parent_id? }` returns `{ id, upload_url, method: "PUT", max_bytes, expires_at }`.
2. `PUT` the bytes to `upload_url` with the same bearer token, `Content-Type: application/octet-stream` and a `Content-Length` equal to `size`. The answer is the created file. Upload ids are single use and expire after 15 minutes.

## Webhooks

Deliveries are `POST` requests with a thin JSON body (ids only):

```json
{ "id": "evt_123", "type": "task.updated", "api_version": "2026-10-24", "created_at": "2026-10-24T09:30:00.000Z",
  "delivery_id": 456, "data": { "object": "task", "id": 789, "project_id": 42 }, "actor_user_id": 7 }
```

Verify `IMPROJ-Signature: t=<unix seconds>,v1=<hex>` where `v1 = HMAC-SHA256(secret, "<t>." + raw body)` with your `whsec_...` secret. Compute it over the **raw** request bytes, compare in constant time, and refuse timestamps more than 300 seconds from now. Then fetch the object through the API. Other headers: `IMPROJ-Event`, `IMPROJ-Delivery`, `IMPROJ-Webhook-Id`, `IMPROJ-API-Version`. The SDKs ship verifiers.

## Security

- Keep tokens on servers. Never ship a personal access token to a browser or a mobile app; proxy through your backend (see improj-react), or use a token restricted to read-only scopes and an exact browser origin.
- Give each integration its own token with the fewest scopes, a project list and an expiry. Revoke tokens you no longer use.
- Report vulnerabilities privately: see [SECURITY.md](SECURITY.md).

## Working on this repository

```sh
npm ci
npm test            # OpenAPI 3.1 schema validation, Spectral lint, unit tests
npm run docs:serve  # reference at http://127.0.0.1:8080/
npm run breaking    # oasdiff against origin/main (oasdiff on PATH)
```

See [CONTRIBUTING.md](CONTRIBUTING.md). The files of this repository are licensed under the [MIT License](LICENSE). `info.license` inside `openapi.json` (Proprietary) refers to the IMPROJ service the description documents, not to these files.
