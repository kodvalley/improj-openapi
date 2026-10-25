# IMPROJ API style guide

The conventions every IMPROJ API endpoint follows. Rules marked **(lint)** are enforced by `.spectral.yaml`; the others are checked in review. SDKs may rely on all of them.

## 1. Transport

- HTTPS only; the server list contains only `https://` URLs **(lint)**.
- JSON only (`application/json`, UTF-8) for requests and responses, except file bytes (`application/octet-stream`).
- Request bodies are at most 256 KB and must be a single JSON object. Compressed request bodies are refused.
- Responses are never cached (`Cache-Control: no-store`) and carry `X-Content-Type-Options: nosniff`.

## 2. Resources and URLs

- Base: `https://improj.com/api/v1`. The major version is in the path; a breaking change creates `/api/v2`.
- Collections are plural nouns in kebab-case (`/work-packages`, `/calendar-events`) **(lint)**.
- Children are nested under their project: `/projects/{project_id}/tasks/{task_id}`. A child id is only valid under its own parent.
- Path parameters are `{snake_case}` and numeric ids are positive integers **(lint)**.
- Query parameters are `snake_case` **(lint)**. Dates are `YYYY-MM-DD`; times are `HH:MM` (24 hour clock).

## 3. Methods and status codes

| Action | Method | Success |
|---|---|---|
| List | `GET /things` | `200` `{ data: [...], next_cursor }` |
| Read | `GET /things/{id}` | `200` `{ data: {...} }` |
| Create | `POST /things` | `201` `{ data: {...} }` |
| Partial update | `PATCH /things/{id}` | `200` `{ data: {...} }` |
| Delete | `DELETE /things/{id}` | `204`, no body |
| Action | `POST /things/{id}/verb` | `200` or `201` |

`PATCH` changes only the fields it sends; `null` clears a nullable field.

## 4. Representation

- Field names are `snake_case` **(lint)**. The one exception is the Enterprise AI agent routes (`Agent`, `AgentItem` and the note body), which keep the camelCase fields of their earlier API; no new schema may add camelCase fields.
- Every documented field is always present; absent values are `null`, never omitted. Lists are arrays, possibly empty.
- Responses are explicit allow-lists; a field is never added to a response because it exists in storage.
- Request schemas are strict: an unknown field is refused with `400 INVALID_INPUT` and an `errors[]` entry naming it. Server-owned fields (ids, owners, timestamps, file metadata) cannot be sent.
- Clients must ignore unknown response fields: new fields are additive changes.
- Timestamps are ISO 8601 in UTC (`2026-10-24T09:30:00.000Z`). Calendar dates and wall-clock times keep their meaning with an IANA `time_zone`.

## 5. Authentication and scopes

- One scheme: `Authorization: Bearer <token>` **(lint)**. No API keys in headers, no cookies, no credentials in the query string **(lint)**.
- Every authenticated operation names exactly one scope in `x-required-scope` **(lint)**. Read scopes end in `:read`, write scopes in `:write` (or `:manage`, `:note`). The scope check runs before any data is read.
- The OpenAPI document itself (`GET /openapi.json`) is the only public operation.

## 6. Errors

- Every 4xx and 5xx answer is `application/problem+json` **(lint)**, and every operation documents the statuses it can return with their codes with `type`, `title`, `status`, `detail`, `instance`, `code`, `request_id` and optional `errors: [{ path, message }]`.
- `code` is stable and documented; `detail` is human text that may change. Clients branch on `code`.
- Reads: any refusal to show a resource is `404 NOT_FOUND`, identical to a missing id.
- Writes: the target is read first (`404` when unseen); a refusal of the action itself keeps its code (`403 VIEWER_READ_ONLY`, `403 PROJECT_ARCHIVED_READ_ONLY`, ...).
- 5xx answers never contain internal detail (no stack, driver or exception text).

## 7. Pagination

- Lists are cursor paginated with `limit` (1 to 100, default 25) and `cursor` **(lint)**.
- `next_cursor` is `null` on the last page. Cursors are opaque, signed and bound to the token, the list and its filters; changing a filter means starting again without a cursor.

## 8. Idempotency and concurrency

- Every `POST` accepts `Idempotency-Key` **(lint)**. Keys live for 24 hours per token. Replays carry `Idempotent-Replayed: true`; a key reused for a different request is `422`; a key whose first request is still running is `409`. 5xx answers are not stored, so the same key can be retried.
- `GET`, `PUT` and `DELETE` are idempotent by definition. `PATCH` is not retried automatically by the SDKs.

## 9. Rate limits

- Limits are per token (all requests, writes, uploads) and per client address, in one-minute windows.
- Every answer carries `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (seconds) and `RateLimit-Policy` (`300;w=60`). `429` carries `Retry-After` (seconds).

## 10. Versioning and deprecation

- `IMPROJ-API-Version: YYYY-MM-DD` on every response; a client may send it to pin, and an unknown value is `400 API_VERSION_UNSUPPORTED`.
- Additive changes (new endpoints, optional request fields, response fields, enum values in responses, events) ship within v1. Clients must tolerate them.
- Removing or renaming anything, tightening a request rule or changing a type is breaking and needs `/api/v2`. `oasdiff breaking` runs on every pull request.
- A deprecated operation is marked `deprecated: true` and announced in the changelog at least 6 months before removal in the next major version.

## 11. Webhooks

- Payloads are thin: `{ id, type, api_version, created_at, delivery_id, data: { object, id, project_id }, actor_user_id }`. Receivers fetch the object through the API.
- Event types are `<object>.<past-tense verb>` (`task.created`, `calendar_event.deleted`).
- Every delivery is signed with HMAC-SHA256 (`IMPROJ-Signature: t=...,v1=...`) over `"<t>." + raw body`, with a 300 second tolerance.

## 12. Naming checklist for a new endpoint

1. Plural kebab-case collection, nested under its project if it belongs to one.
2. `operationId` in lowerCamelCase, verb first: `listX`, `getX`, `createX`, `updateX`, `deleteX` **(lint)**.
3. One scope, the narrowest that fits.
4. Strict request schema with bounds on every string and array.
5. Explicit response schema with every field required (nullable where needed).
6. Problem responses for 400, 401, 403, 404 and 429.
7. Changelog entry.
