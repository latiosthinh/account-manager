# Phase 2: Database Schema & Storage Engine - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Initialize and configure SQLite persistence using native `node:sqlite` in WAL mode (`STOR-01`), execute schema migrations for `categories` and `accounts` tables with foreign key constraints, and idempotently seed default preset categories (`Google`, `Outlook`) on startup (`CATG-01`).

</domain>

<decisions>
## Implementation Decisions

### SQLite Storage Engine Configuration
- Use Node.js native `node:sqlite` (`DatabaseSync`) targeting `data/account-manager.sqlite` (configurable via `DB_PATH` in `.env`).
- Enforce `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, `PRAGMA synchronous = NORMAL`.
- Automatically create the storage directory if it doesn't exist.
- Register graceful database closure on process exit (`SIGINT`, `SIGTERM`).

### Schema Design & Category Seeding
- UUID v4 primary keys (`crypto.randomUUID()`).
- Categories table: `id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, is_preset INTEGER DEFAULT 0, created_at TEXT NOT NULL`.
- Accounts table: `id TEXT PRIMARY KEY, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT, email TEXT NOT NULL, password TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL`.
- Default preset seeding for `Google` and `Outlook` with `is_preset = 1`.

### the agent's Discretion
- Database repository helper methods (`getCategories`, `getCategoryById`, `insertCategory`, `insertAccount`, `getAccounts`, etc.).
- In-memory database mode support for unit testing (`:memory:`).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config.js` for reading `DB_PATH` from environment.
- `src/server.js` for integrating DB startup/teardown with the Express lifecycle.

### Established Patterns
- Pure Node stdlib (no heavy ORMs, zero extraneous packages).
- Clean async/sync separation with `node:sqlite`.

### Integration Points
- `src/db.js` export database initialization and query helpers.
- Downstream Phase 3 routes consume `src/db.js` for category and account CRUD operations.

</code_context>

<specifics>
## Specific Ideas
- Support in-memory database configuration when running tests to ensure test isolation.

</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed within phase scope.

</deferred>
