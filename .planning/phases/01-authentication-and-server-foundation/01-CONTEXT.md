# Phase 1: Authentication & Server Foundation - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the core server framework (Node.js/Express) with `.env` configuration, timing-safe admin password verification (`AUTH-01`, `AUTH-02`), secure `HttpOnly` signed session cookies (`AUTH-03`), and IP rate limiting for failed login attempts (`AUTH-04`).

</domain>

<decisions>
## Implementation Decisions

### Auth & Session Management
- 7 days HMAC-signed HttpOnly cookie for session token.
- 5 attempts per IP per 15 minutes window for failed logins.
- `SESSION_SECRET` loaded from `.env` with fallback auto-generated server instance secret.
- SHA-256 digest comparison via `crypto.timingSafeEqual` to avoid any length or timing leaks.

### Server Architecture & Foundation
- Express server framework with cookie-parser and JSON middleware.
- Configurable `PORT` (default 3000) and `HOST` (0.0.0.0).
- Static assets served from `./public`.
- Strict JSON payload size limit (100KB).

### the agent's Discretion
- Session cookie name (`account_manager_session`).
- Health check route `/api/health`.
- Auth status route `/api/auth/status` returning `{ authenticated: boolean }`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None (greenfield project root).

### Established Patterns
- Node.js ESM (`"type": "module"`).
- Native Node crypto utilities (`node:crypto`).

### Integration Points
- `/api/auth/login` (POST)
- `/api/auth/logout` (POST)
- `/api/auth/status` (GET)
- Authentication middleware for protecting downstream `/api/categories` and `/api/accounts`.

</code_context>

<specifics>
## Specific Ideas
- Provide `.env.example` with clear instructions for setting `ADMIN_PASSWORD` and `SESSION_SECRET`.

</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed within phase scope.

</deferred>
