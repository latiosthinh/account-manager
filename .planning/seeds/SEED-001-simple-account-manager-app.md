---
id: SEED-001
status: dormant
planted: 2026-08-22
planted_during: initial-ideation
trigger_when: Next milestone or when account/credential management phase starts
scope: Large
---

# SEED-001: Simple Category-Based Account Manager App

## Why This Matters

Secure, centralized credential management with masked previews and category organization.
Solves credential clutter and accidental credential leakage during screen share / casual inspection.

## When to Surface

**Trigger:** Next milestone or when building account/credential management features.

Surface during `/gsd-new-milestone` when milestone scope matches:
- Account or credential management functionality
- Admin authentication and environment config (`.env`)
- Category-based credential categorization (Google, Outlook, custom categories)
- Credential masking with reveal toggles (`thinh***@gmail.com` / `****`)

## Scope Estimate

**Large** — Full application milestone:
- Admin password verification against `.env`
- Category system with dynamic category creation
- Account storage and list views with email masking
- Eye-icon reveal toggle for full email and password
- UI layout and CRUD operations

## Breadcrumbs

Related project files:
- `.planning/seeds/SEED-001-simple-account-manager-app.md`
- `.env`

## Notes

Initial user requirements:
- Admin password stored in `.env`
- Category grouping (Google, Outlook, custom additions)
- Email format masked by default (`thinh***@gmail.com`)
- Password masked by default (`****`)
- Eye-icon button toggles full visibility of email and password
