# Phase 1 Plan 2: Express Server Foundation, Auth Routes, and Session Middleware Summary

**One-liner:** Express server with static file serving, HttpOnly HMAC session cookie authentication, 5-attempt brute-force lockout, and full integration test coverage.

## Frontmatter
- **phase:** 01-authentication-and-server-foundation
- **plan:** 02
- **subsystem:** api / server / auth
- **tags:** [express, cookie-auth, middleware, rate-limit, session]
- **dependency graph:**
  - **requires:** [01-01]
  - **provides:** [app, startServer, requireAuth, authRouter]
  - **affects:** [02-database, 03-api, 04-ui]
- **tech-stack:**
  - Express 4
  - `cookie-parser`
  - Node.js built-in `fetch` and `node:test`
- **key-files:**
  - `src/middleware/auth-middleware.js`
  - `src/routes/auth-routes.js`
  - `src/server.js`
  - `public/index.html`
  - `tests/server.test.js`
- **decisions:**
  - Implemented `HttpOnly`, `SameSite=Strict`, 7-day session cookies for authentication.
  - Used `requireAuth` middleware returning 401 JSON for unauthenticated protected route access.
  - Added 404 handler for unmatched `/api` routes and centralized error handler.

## Key Changes
1. Created `src/middleware/auth-middleware.js` exporting `requireAuth`.
2. Created `src/routes/auth-routes.js` with `/api/auth/login`, `/api/auth/logout`, and `/api/auth/status`.
3. Created `src/server.js` assembling Express middlewares, static file serving from `public/`, and healthcheck `/api/health`.
4. Created `tests/server.test.js` covering login, logout, invalid password 401, 5-attempt rate limiter 429 lockout, and protected route access.

## Deviations from Plan
- **[Rule 1 - Bug/Refactor] Rate limiter threshold adjustment:** Configured `LoginRateLimiter` threshold comparison to `>= maxAttempts` so the 5th failed attempt triggers 429 lockout as expected.
- **[Rule 2 - Enhancement] Export `createApp`:** Added `createApp` factory in `src/server.js` so ephemeral integration test instances can attach test routes dynamically before mounting catch-all 404 handlers.

## Self-Check: PASSED
- `src/middleware/auth-middleware.js`: FOUND
- `src/routes/auth-routes.js`: FOUND
- `src/server.js`: FOUND
- `public/index.html`: FOUND
- `tests/server.test.js`: FOUND
- All integration and unit tests pass cleanly via `node --test tests/**/*.test.js`.
