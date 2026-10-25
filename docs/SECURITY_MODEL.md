# IMPROJ API security model

How the IMPROJ public API (`/api/v1`) protects your data, and what an integration must do on its side. It is organised along the [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/). To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Tokens

| Token | Format | Acts as | Reach |
|---|---|---|---|
| Personal access token | `improj_pat_` + 49 characters | You | Projects you can open in the app |
| Organisation token | `improj_org_` + 49 characters | The organisation owner or admin who created it | Only that organisation's projects; stops working as soon as its creator is no longer an owner or admin there |

- Tokens hold 256 bits of randomness plus a checksum, so typos are caught and secret scanners (GitHub, GitLab, gitleaks) recognise them without a lookup.
- IMPROJ stores only a hash of each token. The full value is shown once, when you create it. Lost tokens are replaced, never recovered.
- Options per token: scopes; expiry (7 to 365 days, or none); a project list; an IP allow-list (addresses or CIDR ranges, IPv4 and IPv6); browser origins (exact `https://` origins, at most 5).
- Revocation and expiry take effect on the next request.
- Organisation tokens cannot read personal data (`user:read`) or use the AI agent scopes.

## Sending a token

- Only as `Authorization: Bearer <token>`. A token-like query parameter (`token`, `access_token`, `api_key`, ...) is refused, because URLs end up in logs, proxies and browser history.
- Cookies are removed before the API sees the request. There is no session authentication on `/api/v1`, so there is no CSRF surface.
- Failed authentication is rate limited per client address.

## Authorisation (API1, API3, API5)

- Every request runs as the token's owner through the same rules as the IMPROJ app: project membership, partner boundaries, file visibility, email privacy and read-only seats all apply unchanged. Scopes and token limits can only remove rights.
- Each operation names exactly one scope, checked before any data is read. A token never carries platform administrator rights.
- A resource you may not see answers `404 NOT_FOUND`, the same as an id that does not exist, so ids cannot be probed. A child id (task, file, milestone, event) is accepted only under its own project.
- Responses are explicit allow-lists. Budget data, storage keys and email addresses hidden by their owner are never included.
- Request bodies are strict: unknown fields such as `user_id` or `role` are refused, and server-owned values cannot be set.

## Resource limits (API4, API6)

- Per token and minute: 300 requests, 60 writes, 30 uploads. Per client address: 600. `RateLimit-*` headers on every answer, `Retry-After` on `429`.
- JSON bodies up to 256 KB; every array in a request is bounded; `limit` is at most 100.
- Uploads: up to 16 MB and your plan's per-file limit, an exact `Content-Length`, single-use upload ids valid for 15 minutes.
- No bulk or money flows are exposed: budgets, expenses, contracts, invitations, billing and project creation or deletion stay in the app.
- `Idempotency-Key` makes retries of writes safe instead of duplicating them.

## Browser use and CORS (API8)

- CORS is off by default. If a token lists browser origins, only that exact origin is echoed back; never `*`, never credentials.
- **Never ship a personal access token to a browser or mobile app.** Anyone who can open your page can read it. Prefer a backend proxy that holds the token and exposes only the calls your front end needs (the improj-react package and improj-examples show one). If you must call the API from a browser, use a dedicated token with read-only scopes, a project list, a short expiry and your exact origin.
- API responses carry `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'none'`, `Referrer-Policy: no-referrer` and HSTS.

## Uploads and downloads

- Download links (`GET .../files/{file_id}/download`) are signed and valid for 5 minutes. Fetch them server-side or hand them to the user immediately; do not store them.
- Upload URLs require the same bearer token. The official SDKs only send the token to the configured API origin and build the upload address from the upload id, never from an arbitrary URL in a response.
- File type, size and storage quota are checked when the upload is announced and again when the bytes arrive.

## Webhooks (API7, API10)

- Endpoints must be public `https://` URLs without credentials or fragments. Every delivery resolves the address again and refuses private, loopback, link-local and cloud metadata ranges (including IPv4-mapped forms), pins the connection to the vetted address against DNS rebinding, follows no redirects and times out after 10 seconds.
- Your receiver's answer is never parsed; only its status code matters.
- Payloads are thin (ids only). Before every delivery IMPROJ re-checks that the endpoint owner may still see the object; if not, nothing is sent.
- Each endpoint has its own `whsec_` secret, shown once. **Verify every delivery**:
  1. Read the raw request body as bytes, before any JSON parsing.
  2. Parse `IMPROJ-Signature: t=<unix seconds>,v1=<hex>`; there may be several `v1` values.
  3. Compute `HMAC-SHA256(secret, "<t>." + raw body)` as lowercase hex.
  4. Compare with each `v1` in constant time (`crypto.timingSafeEqual`, `hash_equals`, `crypto.subtle.verify`).
  5. Refuse the delivery if `t` is more than 300 seconds away from your clock.
  6. De-duplicate on `IMPROJ-Delivery` (or the event `id`): retries deliver the same event again.
- Retries: 1 min, 5 min, 30 min, 2 h, 6 h, 12 h. An endpoint that fails 15 times in a row is switched off until its owner turns it on again; answering `410 Gone` stops retries for that delivery.

## Checklist for integrations

- [ ] One token per integration, the fewest scopes, a project list and an expiry.
- [ ] Tokens and webhook secrets live in a secret manager or environment variables, never in source control or client bundles.
- [ ] An IP allow-list for server-to-server integrations with fixed egress addresses.
- [ ] Logs redact `Authorization` headers and anything matching `improj_pat_`, `improj_org_` or `whsec_`.
- [ ] Webhook signatures verified over the raw body, with the 300 second window and de-duplication.
- [ ] POST requests send an `Idempotency-Key`; retries honour `Retry-After`.
- [ ] Unknown response fields are ignored; the client pins `IMPROJ-API-Version`.
- [ ] A leaked token is revoked immediately in Settings > Developers.
