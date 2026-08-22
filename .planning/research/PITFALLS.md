# Domain Pitfalls

**Domain:** Single-Admin Category-Based Credential Manager
**Researched:** 2026-08-22
**Overall Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Client-Side Masking with Unmasked API Payloads
**What goes wrong:** Backend sends full plaintext password and email in initial `GET /api/accounts` payload. Frontend simply styles strings or uses `type="password"` / CSS masking.
**Why it happens:** Developer treats visual masking as a pure UI display task.
**Consequences:** Sensitive credentials immediately exposed in browser memory, DevTools Network tab, DOM inspection, React/Vue state extensions, and web proxy logs. Defeats core value of preventing screen-share / accidental leaks.
**Prevention:**
1. Default account list endpoint (`GET /api/accounts`) must return pre-masked email (e.g., `th***@gmail.com`) and omit password field entirely or return masked placeholder token.
2. Require dedicated reveal endpoint (`POST /api/accounts/:id/reveal` or `GET /api/accounts/:id/secret`) behind active session check.
3. Automatically unmount/clear revealed credential from frontend state after configurable timeout (e.g., 30-60s) or on blur/navigation.
**Detection:** Inspect Network tab on initial load; if raw password strings exist in JSON responses, masking is broken.

---

### Pitfall 2: Timing Attacks on `.env` Plaintext Password Verification
**What goes wrong:** Auth endpoint validates submitted password using standard string comparison `req.body.password === process.env.ADMIN_PASSWORD`.
**Why it happens:** Standard equality operator exits early on first mismatched byte.
**Consequences:** Attacker can measure response time variations over local or low-latency network to deduce password character by character.
**Prevention:**
Use `crypto.timingSafeEqual` with fixed-length buffers or hash inputs before comparison.
```typescript
import crypto from 'node:crypto';

function verifyAdminPassword(input: string, secret: string): boolean {
  const inputHash = crypto.createHash('sha256').update(input).digest();
  const secretHash = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(inputHash, secretHash);
}
```
**Detection:** Code review check for `===` or `==` on password comparisons.

---

### Pitfall 3: No Brute-Force Rate Limiting on Login Endpoint
**What goes wrong:** Single admin password endpoint exposed without rate limiter.
**Why it happens:** Assumed safe because single-user app or runs locally.
**Consequences:** Automated dictionary attacks crack admin password rapidly since there is no account lockout mechanism across multiple user accounts.
**Prevention:**
1. Implement IP-based and global in-memory or SQLite-backed rate limiter on `POST /api/auth/login` (e.g., max 5 failed attempts per 15-minute window).
2. Exponential backoff or constant minimum delay on failure.
**Detection:** Send 50 rapid invalid login requests; if HTTP status remains 401 without 429 Too Many Requests or slowdown, mitigation missing.

---

### Pitfall 4: Plaintext Storage on Disk
**What goes wrong:** Accounts stored in raw JSON file or SQLite without encryption at rest (`ENCRYPTION_KEY` / AES-GCM).
**Why it happens:** Relying solely on `.env` admin password for transport auth while writing direct strings to disk.
**Consequences:** Any unauthorized filesystem access, backup leak, git mistake, or unprivileged process dump exposes every stored credential.
**Prevention:**
1. Derive symmetric encryption key from a dedicated master key in `.env` (e.g., `APP_SECRET` or `ENCRYPTION_KEY`) using AES-256-GCM.
2. Store `iv`, `ciphertext`, and `authTag` per credential field in SQLite / JSON.
3. Never encrypt/decrypt on client side; handle inside secure server boundary.
**Detection:** Read database file or JSON storage directly; plaintext passwords must not appear anywhere.

---

### Pitfall 5: Concurrent File Write Corruption (JSON Storage Trap)
**What goes wrong:** Server uses naive `fs.writeFile` to persist JSON database on every CRUD action. Multiple concurrent requests corrupt the file.
**Why it happens:** Prototype starts with `fs.writeFileSync('db.json', JSON.stringify(data))`.
**Consequences:** Partial writes truncate database to 0 bytes or create invalid JSON, destroying all stored accounts.
**Prevention:**
1. Prefer SQLite (WAL mode enabled) over raw JSON files.
2. If JSON file is mandatory: use atomic write pattern (write to temporary file `db.json.tmp`, `fs.fsync`, then `fs.renameSync` over `db.json`) wrapped in in-process async mutex/queue.
**Detection:** Fire 20 parallel `POST /api/accounts` requests and check JSON integrity.

---

## Moderate Pitfalls

### Pitfall 6: State Desynchronization on Masked Email Regex
**What goes wrong:** Masking logic fails on edge-case emails (e.g., short usernames `a@b.com`, subdomains, plus-addressing `user+tag@domain.com`, non-ASCII).
**Prevention:**
Implement robust unit-tested masking function:
```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}
```

### Pitfall 7: Clipboard Leaks via Copy-to-Clipboard Feature
**What goes wrong:** User clicks "Copy Password". Password lingers in operating system clipboard indefinitely.
**Prevention:**
1. Provide UI copy button with explicit feedback.
2. Optional automatic clipboard clearing after 30 seconds via `navigator.clipboard.writeText('')` when tab active.
3. Set `autocomplete="off"` and `data-lpignore="true"` on credential input fields to prevent rogue browser extensions scraping form fields.

### Pitfall 8: Session Hijacking via Insecure Cookie / Token Storage
**What goes wrong:** Auth token stored in browser `localStorage`. XSS vulnerability exposes total access.
**Prevention:**
1. Use `HttpOnly`, `SameSite=Strict`, `Secure` (in production) cookies for session token.
2. Implement server-side session invalidation on logout.

---

## Minor Pitfalls

### Pitfall 9: Foreign Key / Cascade Orphan Accounts on Category Deletion
**What goes wrong:** User deletes custom category; associated accounts are orphaned or crash filtering UI.
**Prevention:**
1. Reject category deletion if accounts exist under it, OR
2. Require user confirmation to reassign accounts to default "Uncategorized" / "General" preset.

### Pitfall 10: Missing Password Generation / Complexity Validation
**What goes wrong:** User adds empty or whitespace-only password by mistake.
**Prevention:** Strict server-side schema validation (e.g., Zod) ensuring non-empty title, category, and password.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Auth & Security** | Timing attacks, brute-force vulnerability, XSS session theft | `crypto.timingSafeEqual`, rate limiting, `HttpOnly` cookies |
| **Storage & Models** | Plaintext disk storage, JSON file corruption on write | AES-256-GCM encryption helper, SQLite or atomic write rename |
| **Category CRUD** | Orphaned accounts on category deletion | Prevent deletion if category contains accounts or fallback to preset |
| **Account UI & Reveal** | Exposing secrets in list payload, clipboard leaks | Pre-masked backend responses, isolated reveal endpoint, ephemeral UI state |

---

## Sources

- OWASP Password Storage & Authentication Cheat Sheets (Verified)
- Node.js Official `crypto.timingSafeEqual` Documentation (Verified)
- SQLite WAL mode concurrency patterns (Verified)
