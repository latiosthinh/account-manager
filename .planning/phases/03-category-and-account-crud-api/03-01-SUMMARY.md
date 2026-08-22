# Phase 3 Plan 1: Category API Summary

Authenticated Category REST API endpoints with validation, preset locking, orphan prevention, and integration test coverage.

## What Was Done

- Updated `src/db.js`:
  - Added `categoriesRepo.getAllWithCounts()` using SQLite `LEFT JOIN` and `GROUP BY` to aggregate `accountCount` for each category.
  - Added `categoriesRepo.getByName(name)` for case-insensitive duplicate checking.
- Created `src/routes/category-routes.js`:
  - Enforced `requireAuth` across all `/api/categories` routes.
  - Implemented `GET /api/categories` returning list of categories with `accountCount`.
  - Implemented `POST /api/categories` with string validation, trimming, length constraint (1-50 chars), and duplicate rejection (HTTP 400).
  - Implemented `DELETE /api/categories/:id` with preset protection (HTTP 400), account dependency checks (HTTP 409), and not found handling (HTTP 404).
- Mounted `categoryRouter` on `/api/categories` in `src/server.js`.
- Created `tests/categories.test.js` validating authentication requirements, listing, creation, validation errors, and deletion restrictions.

## Verification

Ran `npm test` and `node --test tests/categories.test.js`:
- All 5 category integration tests passed.
- All 23 test cases in the project passed cleanly.

## Key Files Created/Modified

- `src/db.js`
- `src/routes/category-routes.js`
- `src/server.js`
- `tests/categories.test.js`

## Commit

- `09e6cbc`: `feat(03-01): implement category CRUD API and test suite`
