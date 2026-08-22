# Account Manager

## What This Is

A lightweight, secure account management application for organizing categorized credentials (Google, Outlook, and custom categories). It lets authenticated administrators store, list, and reveal credentials on demand with safe-by-default visual masking.

## Core Value

Keep categorized credentials accessible and organized while keeping sensitive email and password values masked by default.

## Current Milestone: v1.0 Simple Category-Based Account Manager App

**Goal:** Build a clean server-backed account manager with .env admin auth, category CRUD, masked credential views, and reveal toggles.

**Target features:**
- Admin authentication verified against `.env`
- Category system with presets (Google, Outlook) and custom additions
- Account list with masked email (`thinh***@gmail.com`) and password (`****`)
- Eye-icon button toggle to reveal unmasked credentials
- Server-side data persistence (JSON/SQLite) accessible via standard server endpoints

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **AUTH-01**: User can authenticate with admin password defined in `.env`
- [ ] **CATG-01**: User can view preset categories (Google, Outlook)
- [ ] **CATG-02**: User can create new custom categories
- [ ] **ACCT-01**: User can add new account (email, password, category)
- [ ] **ACCT-02**: User can view accounts grouped/filtered by category with masked preview
- [ ] **ACCT-03**: User can click eye icon to toggle visibility of email and password
- [ ] **ACCT-04**: User can delete or update account entries
- [ ] **STOR-01**: Server persists categories and accounts reliably

### Out of Scope

- Multi-tenant multi-user role permission system — single admin password in `.env` is sufficient for v1.0
- Complex cloud sync / OAuth provider integrations — simple server storage solves primary use case
- Browser extension autofill — out of scope for initial core release

## Context

- Single admin management model
- Lightweight server architecture (Node.js/Next.js/Express with JSON/SQLite)
- Masked-by-default UX prevents accidental credential exposure during presentation or screen sharing

## Constraints

- **Security**: Admin password never committed to repo; read from `.env`
- **Simplicity**: Minimal dependencies and self-contained server logic

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Admin password in `.env` | Simplest secure mechanism without complex user tables | — Pending |
| Server-backed storage (JSON/SQLite) | Easy local run and simple deployment paths | — Pending |
| Masked credential display | Prevent accidental leak in public/screen-share context | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-22 after milestone v1.0 kickoff*
