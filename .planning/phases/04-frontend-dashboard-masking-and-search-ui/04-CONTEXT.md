# Phase 4: Frontend Dashboard, Masking & Search UI - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a modern, responsive single-page web dashboard (`MASK-01`, `MASK-02`, `MASK-03`, `MASK-04`, `VIEW-01`, `VIEW-02`) that connects to the backend API, allowing the authenticated administrator to manage categories and accounts, view masked credentials by default with eye-icon reveal toggles, copy to clipboard with feedback, and filter accounts via category tabs and real-time search.

</domain>

<decisions>
## Implementation Decisions

### Credential Masking & Reveal Interactions
- Mask email addresses by default (`thinh***@gmail.com` showing first 5 chars if length allows + `***@domain.com`).
- Mask passwords by default (`••••••••`).
- Interactive eye-icon SVG button on both email and password fields to toggle visibility between masked and unmasked.
- One-click copy buttons for email and password with 1.5s temporary "Copied!" badge feedback.

### Dashboard Layout, Filtering & Search
- Modern responsive layout with dark header, clean card grid / lists, and modal forms.
- Top category pill tabs with active state styling and account counts badge.
- Instant client-side search bar filtering accounts in real time.
- Modal dialogs for adding/editing accounts and adding custom categories.
- Confirmation dialogs for deleting accounts or categories.

### the agent's Discretion
- Polished vanilla CSS styling (custom properties, responsive flexbox/grid, focus rings, accessibility).
- Login view transition when unauthenticated vs dashboard when authenticated.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- All backend REST endpoints: `/api/auth/*`, `/api/categories/*`, `/api/accounts/*`.
- Static file serving via `public/index.html` and assets.

### Established Patterns
- Zero external client runtime build step (vanilla ES6 modules / modern CSS).

### Integration Points
- `public/index.html`, `public/app.js`, `public/style.css`.
- E2E tests verifying complete frontend rendering and masking logic.

</code_context>

<specifics>
## Specific Ideas
- Masking helper: `maskEmail(email)` and `maskPassword(password)`.
- Ephemeral UI reveal state held strictly in component state.

</specifics>

<deferred>
## Deferred Ideas
- None — discussion stayed within phase scope.

</deferred>
