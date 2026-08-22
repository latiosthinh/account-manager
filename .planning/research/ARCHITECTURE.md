# Architecture Patterns

**Domain:** Simple Category-Based Account Manager App
**Researched:** 2026-08-22
**Confidence:** HIGH

## Recommended Architecture

Monolithic single-process app (Next.js App Router or Express/Fastify + React/Vite) with local SQLite/JSON storage and encrypted session cookies.

```
+-------------------------------------------------------------+
| Browser Client (React UI)                                   |
| - Password login form                                       |
| - Category filter tabs / sidebar                            |
| - Masked account list with client-side eye reveal toggles   |
| - Modal / inline forms for Account & Category CRUD          |
+------------------------------+------------------------------+
                               | HTTPS / JSON API
                               | Cookie: session_token (Signed)
+------------------------------v------------------------------+
| Server API Layer                                             |
| - POST /api/auth/login    -> verifies .env ADMIN_PASSWORD   |
| - POST /api/auth/logout   -> clears session cookie          |
| - GET  /api/auth/check    -> returns auth state             |
| - GET/POST /api/categories                                  |
| - GET/POST/PUT/DELETE /api/accounts                         |
+------------------------------+------------------------------+
| Auth & Storage Core                                          |
| - Auth Middleware: HMAC SHA-256 signed session cookie       |
| - Storage Engine: SQLite (better-sqlite3) or JSON File db   |
+------------------------------+------------------------------+
                               |
                               v
                       [ File / SQLite DB ]
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Client View Layer | Render UI, handle mask/reveal state locally, trigger CRUD actions | Server API Layer |
| Auth Middleware | Verify signed cookie or timing-safe password compare | .env config, Client View |
| Accounts API Handler | Validate inputs, filter by category, perform CRUD | Storage Driver |
| Categories API Handler | Return presets + custom categories, handle custom creation | Storage Driver |
| Storage Driver | Atomic read/write transactions to file/SQLite | File System |

### Data Flow

1. **Authentication Flow:**
   - Client sends `POST /api/auth/login` with `{ password }`.
   - Server performs `crypto.timingSafeEqual` comparison against `process.env.ADMIN_PASSWORD`.
   - Server returns `Set-Cookie: session_token=<HMAC_SIGNED_PAYLOAD>; HttpOnly; SameSite=Strict; Path=/`.
   - Subsequent requests pass cookie; auth middleware checks signature before processing API requests.

2. **Category & Account Read Flow:**
   - Client requests `GET /api/categories` and `GET /api/accounts?category=<id|all>`.
   - Server checks session cookie.
   - Storage layer fetches matching accounts.
   - Server returns full records `{ id, email, password, categoryId, notes, updatedAt }` to authenticated client.
   - Client renders email as `thinh***@domain.com` and password as `••••••••`.
   - Eye icon toggles unmasked display in client memory. No extra roundtrip needed.

3. **Account Write Flow:**
   - Client sends `POST /api/accounts` with `{ email, password, categoryId, notes }`.
   - Server validates payload, generates UUID / auto-increment ID, timestamps, saves to SQLite/JSON.
   - Server returns created record.

## Data Model

### 1. Categories Schema

```typescript
interface Category {
  id: string;          // e.g. "google", "outlook", or uuid "cat_123"
  name: string;        // e.g. "Google", "Outlook", "Custom Services"
  isPreset: boolean;   // true for system defaults, false for user created
  createdAt: number;   // epoch ms
}
```

### 2. Accounts Schema

```typescript
interface Account {
  id: string;          // uuid
  categoryId: string;  // foreign key -> Category.id
  email: string;       // raw string
  password: string;    // raw string (optionally encrypted at rest via master key if needed)
  notes?: string;      // optional metadata
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
}
```

### 3. Session Model

Stateless HMAC-signed token stored in `HttpOnly` cookie.
```
session_token = base64url(payload) + "." + base64url(hmac_sha256(payload, SESSION_SECRET || ADMIN_PASSWORD))
```
Payload: `{ authenticated: true, exp: timestamp }`. No session table needed in DB.

## Patterns to Follow

### Pattern 1: Constant-Time Password Verification
**What:** Protect admin password checks from timing side-channel attacks.
**When:** `/api/auth/login` endpoint.
**Example:**
```typescript
import crypto from "node:crypto";

export function verifyAdminPassword(input: string): boolean {
  const adminPass = process.env.ADMIN_PASSWORD || "";
  if (!adminPass || !input) return false;

  const a = Buffer.from(input);
  const b = Buffer.from(adminPass);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
```

### Pattern 2: Client-Side Masking with In-Memory Reveal
**What:** Pass credential data to client once authenticated; perform masking and reveal purely in client component state.
**When:** Rendering account tables or cards.
**Example:**
```typescript
// Client-side masking helper
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email.slice(0, 2) + "***";
  const visible = user.slice(0, Math.min(3, user.length));
  return `${visible}***@${domain}`;
}

export function maskPassword(length: number = 8): string {
  return "•".repeat(Math.max(6, length));
}
```

### Pattern 3: Atomic Storage Writes (if using JSON file) or SQLite WAL Mode
**What:** Avoid corruption during concurrent or sudden crashes.
**When:** Persisting accounts and categories.
**Example:**
```typescript
// SQLite configuration
import Database from "better-sqlite3";
const db = new Database("data/accounts.db");
db.pragma("journal_mode = WAL");
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Masking on Server / Requiring Server Roundtrip to Reveal
**What:** Server replaces password with `****` before sending to browser, requiring `POST /api/accounts/:id/reveal` for each item.
**Why bad:** Adds network latency, complex state synchronization, and multiple roundtrips while providing zero extra security if the client is already authenticated with full admin permissions.
**Instead:** Send credentials over HTTPS to authenticated client session; handle masking/reveal locally in React component state.

### Anti-Pattern 2: Complex Multi-User DB & Role Tables for Single Admin
**What:** Creating `users`, `roles`, `permissions`, `refresh_tokens` tables for single `.env` admin password.
**Why bad:** High boilerplate, extra maintenance, unnecessary database schema migrations.
**Instead:** Single `.env` `ADMIN_PASSWORD` + signed stateless session cookie.

## Scalability Considerations

| Concern | Small (10-50 accounts) | Medium (1K-5K accounts) | Future (50K+ accounts) |
|---------|------------------------|-------------------------|------------------------|
| Database | JSON file / SQLite WAL | SQLite WAL with index on `categoryId` | SQLite / PostgreSQL |
| API Payload | Single fetch for all accounts | Paginated or category-filtered fetch | Category-filtered + cursor pagination |
| Search / Filter | Client-side array filtering | Client-side or basic SQLite `LIKE` | SQLite FTS5 index |

## Sources

- Node.js crypto documentation (`crypto.timingSafeEqual`)
- OWASP Session Management Cheat Sheet (Signed HttpOnly SameSite cookies)
- SQLite WAL mode standard documentation
