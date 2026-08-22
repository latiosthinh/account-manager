# Feature Landscape

**Domain:** Lightweight Personal Account & Credential Manager
**Researched:** 2026-08-22

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Admin Authentication Gate** | Protects credentials from unauthorized local network or host access. Single-password check against `.env`. | Low | Session cookie / JWT after verifying `.env` admin password. |
| **Category Organization** | Users group accounts by service type (presets: Google, Outlook; plus custom categories). | Low | Allows category filtering, badge counts, and categorized listing. |
| **Account CRUD** | Core capability to create, update, list, and delete account records (label, email/username, password, category, notes/URL). | Low | Forms require basic validation (non-empty email, category selection). |
| **Masked-by-Default Display** | Protects sensitive credentials against shoulder surfing and accidental screen-share leaks. | Low | Mask email (`thinh***@gmail.com`) and password (`••••••••`) on load. |
| **Reveal Toggle (Eye Icon)** | Users must verify credentials before using or updating them. | Low | Independent toggle per field (reveal email, reveal password) with clear active/inactive state. |
| **One-Click Copy to Clipboard** | Typing complex passwords manually is error-prone; instant copy is primary user action. | Low | Use `navigator.clipboard.writeText` with short visual feedback (checkmark / "Copied!"). |
| **Search & Instant Filter** | Finding specific accounts across categories without scrolling through large lists. | Low | Client-side fuzzy or substring matching across account label, email, and category. |
| **Persistent Server Storage** | Credentials must survive server restarts and container rebuilds without data loss. | Low | SQLite or atomic file-based JSON storage on backend. |

## Differentiators

Features that set product apart. Not expected, but valued for personal utility.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Built-in Password Generator** | Generates strong random passwords directly inside create/edit modal. | Low | Configurable length, symbols, numbers toggle. Avoids external tools. |
| **Auto-Lock on Inactivity** | Automatically locks session if tab is idle for 5–15 minutes. | Low | Prevents exposure on unattended workstations. |
| **One-Click JSON Backup & Restore** | Zero-lock-in export/import for disaster recovery and offline backups. | Low | Download full encrypted/plain JSON snapshot and restore from file upload. |
| **Quick Launch URL with Favicon** | Direct link to service login page with automatic favicon icon display. | Low | Speeds up navigation from account entry to login portal. |
| **Metadata & Last Updated Tracker** | Shows when password was last changed or created. | Low | Helps identify stale credentials. |

## Anti-Features

Features to explicitly NOT build for lightweight personal account manager.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multi-Tenant User Management & RBAC** | Massive schema complexity, user invites, role hierarchy, permission bugs. Single-admin use case. | Keep single admin password defined in `.env`. |
| **Browser Extension & Autofill Engine** | High maintenance (Manifest V3, cross-browser quirks, DOM security vulnerabilities). | Provide fast, accessible one-click copy buttons in web UI. |
| **Cloud Provider OAuth Sync (Google/MS Login)** | Introduces external API dependencies, client IDs, internet requirement, privacy leaks. | Self-contained local server auth with `.env`. |
| **Enterprise Secret Vaults (LDAP, SAML, Shamir Shares)** | Over-engineered for personal/small team deployment; high setup friction. | Simple, self-hosted file/SQLite persistence. |
| **Unmasked Initial Render / Plaintext DOM Dump** | Exposes all passwords in raw DOM/HTML or screen capture if masked state is client-only decoration. | Store masked state in component state; only reveal explicitly toggled item. |
| **Realtime WebSockets / Collaborative Sync** | Unnecessary concurrency overhead and conflict resolution for single-admin tool. | Standard REST endpoints with immediate UI state update. |

## Feature Dependencies

```
Admin Auth (.env) ──► Category Management ──► Account Creation (ACCT-01)
                             │                       │
                             ▼                       ▼
                     Category Filtering ──► Masked Account List (ACCT-02)
                                                     │
                                                     ├──► Eye Toggle Reveal (ACCT-03)
                                                     ├──► One-Click Copy
                                                     └──► Edit / Delete CRUD (ACCT-04)
```

## MVP Recommendation

Prioritize (v1.0 Milestone):
1. **AUTH-01**: Admin login screen checking `.env` password with session cookie/token.
2. **CATG-01 & CATG-02**: Preset categories (Google, Outlook) and custom category creation/listing.
3. **ACCT-01 & ACCT-04**: Account create, edit, delete with category association.
4. **ACCT-02 & ACCT-03**: Masked-by-default credential list with independent eye-icon reveal toggles.
5. **STOR-01**: Server-side reliable persistence (JSON file or SQLite).
6. **One-Click Copy**: Clipboard copy buttons with visual feedback for email and password.
7. **Search/Filter Bar**: Filter accounts by text and active category tab.

Defer to Post-v1.0:
- Built-in password generator (nice to have, but users can paste existing passwords).
- JSON backup export/import (manual file copy works initially).
- Inactivity auto-lock timer.

## Sources

- Bitwarden / KeePass / 1Password UX patterns for credential masking and clipboard handling.
- OWASP Password Storage & Web Application Security Best Practices.
- Project specification: `.planning/PROJECT.md`.
