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

[Unreleased]: https://github.com/kodvalley/improj-openapi/compare/v2026.10.24...HEAD
[2026.10.24]: https://github.com/kodvalley/improj-openapi/releases/tag/v2026.10.24
