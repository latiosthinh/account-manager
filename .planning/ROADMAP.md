# Roadmap: Account Manager

## Milestones

- **v1.0 Simple Category-Based Account Manager App** — [Archived](.planning/milestones/v1.0-ROADMAP.md) (Shipped 2026-08-22)
- **v1.1 Step-up Authentication for Credential Access** — Active (Phases 5-5)

## Phase Details

### Phase 5: PIN & Passkey Step-up Authentication for Password Reveal and Copy
**Goal:** Require explicit PIN or WebAuthn/Passkey verification when revealing or copying account passwords, keeping email reveal/copy instant while adding robust step-up protection for sensitive credentials.
**Requirements:** [AUTH-05, AUTH-06, AUTH-07, AUTH-08]
**Plans:** 2 plans

Plans:
- [ ] 05-01-PLAN.md — PIN & WebAuthn Step-up Backend API & Storage
- [ ] 05-02-PLAN.md — Step-up Modal UI & Password Reveal/Copy Gate Integration
