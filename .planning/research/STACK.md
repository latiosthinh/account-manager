# Technology Stack

**Project:** Account Manager (v1.0)
**Researched:** 2026-08-22
**Confidence:** HIGH

## Recommended Stack

Minimal single-process stack. Zero build step, stdlib-first, native SQLite support via Node.js v22.5+.

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | v24.x (>= 22.5.0) | Runtime & built-in web server / SQLite / test runner | Built-in `node:sqlite`, `node:http`, `node:test`, `node:crypto`. Zero npm dependency baseline. |
| Fastify (or micro-router with `node:http`) | Fastify ^5.x (or pure Node stdlib) | HTTP routing & JSON schema validation | Fastify gives rock-solid route handling, session/cookie plugin ecosystem, fast JSON serialization without heavy build tools. Pure `node:http` or Express/Fastify both viable; Fastify recommended if using small router lib. |

### Database & Storage
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:sqlite` (built-in SQLite) | Node native | Persistent tabular store for accounts & categories | Zero external C-bindings or build toolchains (no `better-sqlite3` compile step required on Windows). Single `.sqlite` file on disk. ACID compliant. |

### Frontend / UI
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla HTML5 / CSS (Tailwind CDN / modern CSS) + ES Modules | Native browser | Admin UI, category filters, masked/unmasked toggle | Single-page UI served directly as static files from backend. No Webpack, Vite, or bundle overhead needed. Eye icon toggle via SVG inline + vanilla JS DOM state. |

### Authentication & Security
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:crypto` | Native | Session token hashing & timing-safe password comparison | `crypto.timingSafeEqual` prevents timing attacks against `.env` admin password. Signed cookie / bearer token stored in HTTP-only cookie. |
| `.env` (`--env-file=.env`) | Native Node | Secret admin password storage | Native Node.js flag `--env-file=.env` requires zero `dotenv` package dependency. |

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/cookie` | ^10.x | HTTP-only cookie parsing | Session token storage in browser. |
| `@fastify/static` | ^8.x | Static file serving | Serving `public/index.html` and assets. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runtime/Framework | Node.js + Fastify (or stdlib) | Next.js / Remix | Massive dependency tree, slow cold start, unnecessary SSR complexity for single-admin tool. |
| Database | `node:sqlite` (native) | Plain JSON file store (`data.json`) | Race conditions on concurrent writes, risk of partial write corruptions on crash. SQLite gives transactions for free with zero extra install. |
| Database | `node:sqlite` (native) | `better-sqlite3` / `sqlite3` | Requires node-gyp and native compile step, prone to Windows build errors. Native `node:sqlite` requires 0 install. |
| UI Framework | Vanilla HTML/CSS/JS | React / Vue SPA | Requires Vite/bundler build pipeline, node_modules bloat. Simple account table + modal needs < 200 lines vanilla JS. |
| Auth | Timing-safe `.env` check + HTTP session token | Passport / Auth0 / NextAuth | Overkill for single admin. Simple SHA-256 session token map in memory or SQLite is sufficient and robust. |

## Installation

```bash
# Initialize minimal package.json
npm init -y

# Optional minimal Fastify setup (or use pure native node stdlib)
npm install fastify @fastify/cookie @fastify/static

# Dev dependencies (optional)
npm install -D nodemon
```

## Running & Deployment

```bash
# Local development (Node 22+)
node --env-file=.env --watch server.js

# Production / Docker
# Single file command, single volume mount for accounts.db
node --env-file=.env server.js
```

## Sources

- Node.js Official Documentation: `node:sqlite` module (Node.js >= 22.5.0, v24.0.2 in current environment)
- Node.js Official Documentation: `--env-file` native flag
- Node.js Official Documentation: `node:crypto` timingSafeEqual
