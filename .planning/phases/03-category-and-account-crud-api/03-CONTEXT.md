# Phase 3: Category & Account CRUD API - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement authenticated REST endpoints and business logic for category management (`CATG-02`, `CATG-03`, `CATG-04`) and account credential CRUD operations (`ACCT-01`, `ACCT-02`, `ACCT-03`), protected by session auth middleware.

</domain>

<decisions>
## Implementation Decisions

### Category API & Validation
- Name validation: required, trimmed, 1-50 chars, case-insensitive uniqueness.
- Deletion protection: Block deletion of preset categories (`is_preset = 1`) with 400 Bad Request, and block deletion of custom categories containing active accounts with 409 Conflict.
- Category listing returns all categories along with `accountCount` integer.
- Endpoints: `GET /api/categories`, `POST /api/categories`, `DELETE /api/categories/:id`.

### Account API & CRUD Operations
- Account fields: `email` (string, required), `password` (string, required), `categoryId` (string, valid category ID required), `notes` (string, optional).
- Endpoints: `GET /api/accounts`, `POST /api/accounts`, `PUT /api/accounts/:id`, `DELETE /api/accounts/:id`.
- All routes protected by `requireAuth` middleware.

### the agent's Discretion
- Input validation sanitization helper.
- Standardized JSON error response format `{ error: string }`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/middleware/auth-middleware.js` for authenticating all API routes.
- `src/db.js` repository methods (`getCategories`, `createCategory`, `getAccounts`, `createAccount`, `updateAccount`, `deleteAccount`, etc.).

### Established Patterns
- Express router modules (`src/routes/category-routes.js`, `src/routes/account-routes.js`).
- Structured testing with Node test runner (`tests/categories.test.js`, `tests/accounts.test.js`).

### Integration Points
- Mount category routes at `/api/categories`.
- Mount account routes at `/api/accounts`.
- Consume by Phase 4 frontend dashboard.

</code_context>

<specifics>
## Specific Ideas
- Return 409 Conflict when attempting to delete a category that still contains accounts.

</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed within phase scope.

</deferred>
