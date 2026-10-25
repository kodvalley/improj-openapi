# Changelog

All notable changes to the IMPROJ API description are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The API is versioned by date (`IMPROJ-API-Version`) inside the major path version (`/api/v1`); release tags use the form `vYYYY.MM.DD`.

## [Unreleased]

## [2026.10.24] - 2026-10-24

### Added

- First public description of `/api/v1`, API version `2026-10-24`.
- Resources: me; projects with work packages and activities; tasks, milestones and calendar events (list, read, create, update, delete); members; files (list, metadata, signed download link, two-step upload); meetings; webhook endpoints (list, create, read, update, delete, test, delivery log).
- Earlier read-only routes kept in v1: `GET /calendar` and the Enterprise AI agent routes (`/agents`, `/agents/{agent_id}/items`, `POST /agents/{agent_id}/notes`).
- Webhook events: `task.*`, `milestone.*`, `file.created`, `file.deleted`, `member.added`, `member.removed`, `calendar_event.*`, `project.updated`, plus `ping` from the test endpoint.
- Scopes: `user:read`, `projects:read`, `tasks:read`, `tasks:write`, `milestones:read`, `milestones:write`, `members:read`, `files:read`, `files:write`, `calendar:read`, `calendar:write`, `meetings:read`, `webhooks:manage`, `agent:read`, `agent:note`.
- Reference viewer, API style guide, security model, Spectral ruleset, OpenAPI 3.1 validation and oasdiff breaking-change checks.
- Every error response (400, 401, 403, 404, 405, 409, 413, 415, 422, 429, 500, 503) with its codes, and the headers `RateLimit-Policy`, `Retry-After`, `IMPROJ-API-Version`, `Idempotent-Replayed`, `WWW-Authenticate` and `Allow`.
- Request headers `IMPROJ-API-Version` (version pin) and `X-Request-Id` (your own request id, echoed back).
- Typed `GET /calendar` (`CalendarItem`) and AI agent routes (`Agent`, `AgentItem`, `AgentNote`); `GET /agents/{agent_id}/items` also answers a signed `next_cursor` (preferred) next to the earlier numeric `nextCursor`.
- Webhook headers `IMPROJ-Webhook-Id` and `IMPROJ-API-Version`, and the `ping` event.
- `info.contact` with the Kodvalley contact address (info@kodvalley.com) in this copy of the description.
- Tag and parameter descriptions, enums for webhook events, `format: uri` and an `https://` pattern for webhook URLs, and real integer bounds.

### Note on the breaking-change baseline

Before this first release the description was completed to match what the server already enforced (required agent note fields, the agent item limit of 50, enum-checked webhook events, https-only webhook URLs, positive ids). oasdiff reports these as breaking against the earlier draft; the API's behaviour did not change. Later pull requests are compared against this version.

[Unreleased]: https://github.com/kodvalley/improj-openapi/compare/v2026.10.24...HEAD
[2026.10.24]: https://github.com/kodvalley/improj-openapi/releases/tag/v2026.10.24
