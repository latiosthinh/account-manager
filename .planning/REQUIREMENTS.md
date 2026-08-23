# Requirements: Account Manager

**Defined:** 2026-08-22
**Core Value:** Keep categorized credentials accessible and organized while keeping sensitive email and password values masked by default.

## v1 Requirements

Requirements for Milestone v1.0. Each maps directly to roadmap phases.

### Authentication & Security

- [x] **AUTH-01**: User can log in using `ADMIN_PASSWORD` defined in `.env`
- [x] **AUTH-02**: System validates password using constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks
- [x] **AUTH-03**: System manages authenticated session via secure, signed `HttpOnly` cookie with logout capability
- [x] **AUTH-04**: System rate-limits failed login attempts to prevent brute-force attacks

### Step-up Security (v1.1 / Phase 5)

- [ ] **AUTH-05**: User can configure an optional or required numeric PIN or WebAuthn / Passkey credential for unlocking sensitive actions
- [ ] **AUTH-06**: System validates PIN with timing-safe comparison and rate-limiting on verify endpoint
- [ ] **AUTH-07**: System issues short-lived step-up token / grant (e.g. 5-15 minutes or per-action) allowing password reveal and password copy
- [ ] **AUTH-08**: Frontend intercepts password reveal (eye icon) and password copy buttons to prompt for PIN / Passkey if step-up authorization is not active, while email reveal and copy remain unhindered

### Category Management

- [x] **CATG-01**: System seeds default preset categories (`Google`, `Outlook`) on initial startup
- [x] **CATG-02**: User can create new custom categories
- [x] **CATG-03**: User can view list of all categories and account counts per category
- [x] **CATG-04**: User can delete custom categories with protection against orphaned accounts (prevent delete if accounts exist or prompt reassign)

### Account Management & Persistence

- [x] **ACCT-01**: User can add new account credential entry with email/username, password, category, and optional notes
- [x] **ACCT-02**: User can edit existing account details (email, password, category, notes)
- [x] **ACCT-03**: User can delete an account entry
- [x] **STOR-01**: System persists categories and accounts in SQLite database with WAL mode enabled

### Masked Display & Reveal Interactions

- [x] **MASK-01**: System displays email addresses masked by default in listing (e.g. `thinh***@gmail.com`)
- [x] **MASK-02**: System displays passwords masked by default in listing (e.g. `••••••••` or `****`)
- [x] **MASK-03**: User can click eye-icon button on email or password to toggle visibility between masked and plaintext
- [x] **MASK-04**: User can click quick-copy button to copy plaintext email or password to clipboard with temporary visual feedback

### Search & Filtering UI

- [x] **VIEW-01**: User can filter account list by selecting category tabs (`All`, `Google`, `Outlook`, custom categories)
- [x] **VIEW-02**: User can search accounts in real time by email or category name

## v2 Requirements

Deferred to future releases.

### Backup & Sync

- **BACK-01**: User can export all credentials to an encrypted JSON backup file
- **BACK-02**: User can import accounts from JSON backup file

### Security Enhancements

- **SECU-01**: Inactivity auto-lock timer that locks vault after N minutes of no user interaction
- **SECU-02**: Built-in client-side secure random password generator tool

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant user RBAC | Personal single-admin application model; multi-user adds unnecessary overhead |
| Cloud OAuth integrations | Standalone zero-cloud local/private server focus |
| Browser autofill extension | Focus is web dashboard manager; extension architecture deferred |
| Plaintext password export | High security leak risk for v1 |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| STOR-01 | Phase 2 | Complete |
| CATG-01 | Phase 2 | Complete |
| CATG-02 | Phase 3 | Complete |
| CATG-03 | Phase 3 | Complete |
| CATG-04 | Phase 3 | Complete |
| ACCT-01 | Phase 3 | Complete |
| ACCT-02 | Phase 3 | Complete |
| ACCT-03 | Phase 3 | Complete |
| MASK-01 | Phase 4 | Complete |
| MASK-02 | Phase 4 | Complete |
| MASK-03 | Phase 4 | Complete |
| MASK-04 | Phase 4 | Complete |
| VIEW-01 | Phase 4 | Complete |
| VIEW-02 | Phase 4 | Complete |
| AUTH-05 | Phase 5 | Pending |
| AUTH-06 | Phase 5 | Pending |
| AUTH-07 | Phase 5 | Pending |
| AUTH-08 | Phase 5 | Pending |

**Coverage:**
- Active requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓
