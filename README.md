# Account Manager 🔐

A lightweight, secure, and private account & credential manager with categorized grouping and safe-by-default visual masking.

---

## Features

- **🛡️ Admin Password & PIN Protection**:
  - Vault access protected with master `ADMIN_PASSWORD` (timing-safe verification, sliding-window rate limiting).
  - Optional secondary `PIN_CODE` (or Passkey / Biometrics) challenge before revealing or copying passwords.
- **📂 Flexible Categorized Vault**:
  - Store full account pairs (email + password), API keys only, or CLI commands/secrets.
  - Default presets (`Google`, `Outlook`) and custom categories with delete protection for active records.
- **👁️ Safe-by-Default Masking**:
  - Email addresses are masked by default (e.g. `thinh***@gmail.com`).
  - Passwords are masked by default (`••••••••`).
  - Click directly on masked/revealed email or password to copy to clipboard with a visual feedback badge (triggers PIN/Passkey challenge for passwords).
  - Dedicated header actions to toggle visibility:
    - 👁️ **Eye Icon**: Reveal / hide username & email.
    - 🔓 **Lock / Unlock Icon**: Reveal / hide password (triggers PIN/Passkey challenge).
- **🔍 Real-Time Search & Filtering**: Instant search across emails, categories, and notes. Category tab filters with live count badges.
- **💾 Zero-Config SQLite Storage**: Built using Node.js native `node:sqlite` in WAL mode for persistent, zero-dependency storage.

---

## Quick Start

### 1. Prerequisites
- Node.js `v22+` / `v24+`

### 2. Setup Environment

Create a `.env` file in the project root:

```bash
ADMIN_PASSWORD=your_secure_admin_password
PIN_CODE=123456
SESSION_SECRET=a_long_random_session_secret_key
PORT=3000
HOST=0.0.0.0
DB_PATH=data/account-manager.sqlite

# Optional: For persistent cloud storage on Vercel / Cloud deployments
# Get free cloud SQLite from https://turso.tech
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token
```

### 3. Install & Run

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

```bash
npm start     # Starts application on configured PORT
npm test      # Runs full automated test suite (node:test)
```

---

## Architecture & Stack

- **Runtime**: Node.js (ES Modules)
- **Database**: Native `node:sqlite` (`DatabaseSync` + WAL mode)
- **Auth**: HMAC SHA-256 signed `HttpOnly` session cookies
- **Backend**: Express 5
- **Frontend**: Semantic HTML5, responsive modern CSS, Vanilla ES6 JavaScript (zero build step)

---

## License

MIT
