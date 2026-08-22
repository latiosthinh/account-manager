# Research Summary: Account Manager (v1.0)

**Project:** Simple Category-Based Account Manager App  
**Researched:** 2026-08-22  
**Overall Confidence:** HIGH  

---

## Executive Summary

Account Manager is a lightweight, single-admin personal credential management web application. Built for security, speed, and zero operational friction, the system allows organizing credentials by presets (Google, Outlook) and custom categories with masked-by-default display, one-click copy, and individual eye-icon reveals.

The recommended architectural approach is a single-process Node.js service using built-in native capabilities (`node:sqlite`, `node:crypto`, `node:http` or Fastify) paired with a responsive, zero-build vanilla JS / HTML5 frontend. This avoids complex build chains, client-side bundle bloat, and external database daemon dependencies while delivering ACID transactions and sub-millisecond response times.

Key risks identified across research include timing attacks against `.env` passwords, unmasked credentials exposed via bulk API payloads or plaintext disk persistence, and concurrent JSON file write corruptions. These are mitigated by using `crypto.timingSafeEqual` with hashed buffers, `HttpOnly` signed session cookies, dedicated server-side reveal endpoints with masked list payloads, AES-256-GCM encryption at rest, and native SQLite in WAL mode.

---

## Key Findings

### Technology Stack (`STACK.md`)
- **Runtime & DB:** Node.js (>= 22.5.0 / v24.x) with native `node:sqlite`. Zero npm dependencies required for persistence; ACID compliant with single-file database.
- **Server Framework:** Fastify (^5.x) or native `node:http` with `@fastify/cookie` and `@fastify/static`.
- **Frontend:** Vanilla HTML5 / CSS (modern CSS/Tailwind CDN) + ES Modules. Zero bundler/transpiler overhead; fast client-side DOM state management.
- **Security & Config:** Native `--env-file=.env` for `ADMIN_PASSWORD` and `APP_SECRET`; `node:crypto` for session HMAC signing, AES-256-GCM encryption, and constant-time password checks.

### Feature Landscape (`FEATURES.md`)
- **Table Stakes (v1.0 MVP):**
  - Single admin authentication gate via `.env` password.
  - Preset categories (Google, Outlook) + custom category creation and filtering.
  - Account CRUD (label, email/username, password, category, notes/URL).
  - Masked-by-default display for both email and password in table/card views.
  - Independent eye-icon reveal toggles for fields.
  - One-click copy to clipboard with visual feedback.
  - Real-time client-side search and category filtering.
- **Anti-Features (Explicitly Avoid):**
  - Multi-tenant user RBAC / user management.
  - Browser extensions & autofill injection engines.
  - Third-party OAuth cloud sync (Google/Microsoft login).
  - Real-time WebSockets / complex synchronization.

### Architecture Patterns (`ARCHITECTURE.md`)
- **Monolithic Single-Process:** Direct client-to-server REST API over HTTPS with `HttpOnly` session cookies.
- **Stateless HMAC Sessions:** Cookie contains signed payload `{ authenticated: true, exp }` signed with server secret; avoids session database table.
- **Data Boundary & Masking:** List endpoints return masked records; specific item reveal requests fetch decrypted secrets on-demand or keep client-side visual state cleanly isolated.
- **SQLite Storage in WAL Mode:** Native `node:sqlite` connection with `PRAGMA journal_mode = WAL` prevents concurrency bottlenecks and write locks.

### Pitfalls & Prevention (`PITFALLS.md`)
- **Timing Attacks:** Plain `===` on admin password enables character-by-character timing deductions. Fix: Hash inputs with SHA-256 and compare via `crypto.timingSafeEqual`.
- **Bulk Payload Credential Leaks:** Sending plaintext secrets in account lists exposes data to DevTools/proxies. Fix: Return masked placeholders in `GET /api/accounts`, load secret on reveal or keep in-memory transient state.
- **Brute-Force Vulnerability:** Single password endpoint without rate limiting is vulnerable to local network attacks. Fix: IP and memory-based rate limiter (max 5 failed attempts per 15 min).
- **Plaintext at Rest & File Corruption:** Unencrypted storage and naive `fs.writeFile` risk data leak and 0-byte truncation. Fix: AES-256-GCM field encryption + SQLite transactions.
- **Category Orphaned Accounts:** Deleting custom categories breaks foreign keys. Fix: Prevent deletion if accounts exist or reassign to default preset.

---

## Implications for Roadmap

### Suggested Phase Structure

1. **Phase 1: Project Scaffolding, Security & Auth Engine**
   - **Rationale:** Foundation for all routes. Security constraints (timing attack mitigation, rate limiting, session cookies) must be established before handling sensitive records.
   - **Delivers:** Server setup, `--env-file` loading, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/check`, timing-safe password verification, rate limiter, signed `HttpOnly` cookie middleware.
   - **Pitfalls avoided:** Timing attacks (Pitfall 2), brute-force attacks (Pitfall 3), session hijacking (Pitfall 8).

2. **Phase 2: Database Schema & Storage Engine with Encryption**
   - **Rationale:** Persistent data layer needed before categories and accounts can be saved and retrieved reliably.
   - **Delivers:** `node:sqlite` database initialization, WAL mode setup, Category and Account schemas, AES-256-GCM encryption/decryption utilities for sensitive fields at rest, preset category seeding (Google, Outlook).
   - **Pitfalls avoided:** Plaintext disk storage (Pitfall 4), JSON file write corruption (Pitfall 5).

3. **Phase 3: Category & Account CRUD API Layer**
   - **Rationale:** Business logic and REST endpoints connecting authenticated requests to storage.
   - **Delivers:** `GET /api/categories`, `POST /api/categories`, `DELETE /api/categories` (with cascade protection), `GET /api/accounts` (pre-masked response), `POST /api/accounts`, `PUT /api/accounts/:id`, `DELETE /api/accounts/:id`, `GET /api/accounts/:id/reveal`.
   - **Pitfalls avoided:** Unmasked bulk API payload leaks (Pitfall 1), orphaned accounts on category delete (Pitfall 9), empty input validation (Pitfall 10).

4. **Phase 4: Frontend UI, Credential Masking & Clipboard Interactions**
   - **Rationale:** End-user interface integrating all CRUD operations, responsive styling, and core UX interactions.
   - **Delivers:** Login view, main dashboard with category tabs/sidebar, search input, account cards/table, independent eye-icon reveal toggles, one-click copy buttons with toast/checkmark feedback, account create/edit modal.
   - **Pitfalls avoided:** Edge-case email masking failures (Pitfall 6), clipboard security issues (Pitfall 7).

5. **Phase 5: End-to-End Verification & Hardening**
   - **Rationale:** Final verification pass covering security boundaries, edge cases, and session workflows.
   - **Delivers:** End-to-end integration tests using `node:test`, rate limiter validation, security review of rendered DOM and DevTools payloads, packaging verification.

---

## Research Flags

- **Standard Patterns (Skip deep research phase):**
  - Phase 1 (Auth & Cookies): Well-established Node.js crypto and cookie patterns.
  - Phase 3 (REST Endpoints): Standard CRUD routing and schema validation.
  - Phase 4 (Frontend UI): Standard vanilla DOM manipulation, CSS, and `navigator.clipboard`.
- **Needs Focused Research / Careful Planning:**
  - Phase 2 (Storage & Encryption): Exact API ergonomics for `node:sqlite` in Node 22+/24+ (handling prepared statements and WAL mode) alongside Node `crypto.cipher` AES-256-GCM key derivation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Node.js native features (`node:sqlite`, `node:crypto`) verified available in modern Node runtime. |
| Features | HIGH | Clear single-admin personal tool requirements with explicit MVP and anti-feature boundaries. |
| Architecture | HIGH | Monolithic single-process REST architecture matches lightweight project goals. |
| Pitfalls | HIGH | Critical security pitfalls (timing attacks, disk exposure, API leaks) documented with actionable mitigations. |

### Gaps to Address During Planning
- Confirm whether custom category deletion should block deletion if accounts exist or reassign them to a default category.
- Confirm exact mask formatting rules for short emails (e.g. `a@b.com` vs standard emails).

---

## Sources

- Node.js Official Documentation (`node:sqlite`, `node:crypto`, `--env-file`)
- OWASP Web Security Cheat Sheet Series (Authentication, Password Storage, Session Management)
- Bitwarden & 1Password UX specifications for credential masking and clipboard handling
- SQLite WAL mode official concurrency documentation
