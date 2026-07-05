<div align="center">

# Bridgistic

**Connect Claude to WordPress safely.**

*Signed requests · scoped keys · approvals on destructive ops · audit logs · snapshots · local MCP setup*

[![License: GPL v2+](https://img.shields.io/badge/License-GPL_v2%2B-blue.svg)](LICENSE)
[![WordPress 6.4+](https://img.shields.io/badge/WordPress-6.4%2B-21759b.svg?logo=wordpress&logoColor=white)](https://wordpress.org/)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Claude Code Marketplace](https://img.shields.io/badge/Claude_Code-Marketplace-d97757.svg)](#3a-install-in-claude-code)

**Free public version** · by [WordPressistic](https://wordpressistic.com)

</div>

---

## What is Bridgistic?

Bridgistic is a safe bridge between Claude and your WordPress site. Instead of handing an AI a full-admin Application Password, you mint a **scoped key** in WordPress and run a **local MCP server** that signs every request with it. The WordPress plugin verifies the signature, enforces the key's scopes, queues destructive operations for human approval, snapshots before risky writes, and logs everything.

```
Claude Desktop / Claude Code
        │  (MCP, local)
        ▼
Bridgistic MCP server  ──  HMAC-signed HTTPS  ──▶  WordPress plugin
                                                    · scope checks
                                                    · approval queue
                                                    · snapshots + rollback
                                                    · audit log
```

## What this repo includes (free version)

- **Claude Code plugin marketplace** — install with two slash commands
- **Local MCP server** (Node 20+, stdio) with 43 WordPress tools
- **WordPress plugin** with a full admin dashboard: guided Claude Setup, Keys & Scopes, Health Check (16 diagnostics), audit Logs, Snapshots, manual + limited scheduled Playbooks, and an Export Package builder
- HMAC-SHA256 authentication, replay protection, scoped least-privilege keys
- Example configs, install scripts, and step-by-step docs

## What it does NOT include

The free version is the complete local bridge. These belong to **Bridgistic SaaS** (separate, private product): AI skills marketplace (SEO/AIO/Schema audits), remote/cloud MCP connector, multi-site agency dashboard, team permissions, advanced logs & snapshots, usage billing, and white-label. See [docs/FREE_VS_PAID.md](docs/FREE_VS_PAID.md).

---

## Quick start

### 1. Install the WordPress plugin

Download `bridgistic-wordpress-plugin.zip` from [Releases](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/releases) (or build it: `npm install && npm run build && npm run package`), then upload via **WP Admin → Plugins → Add New → Upload** and activate. Details: [docs/WORDPRESS_SETUP.md](docs/WORDPRESS_SETUP.md).

### 2. Generate a key

Open **WP Admin → Bridgistic → Claude Setup**, pick a connection type and a permission preset (start with **Read-only**), and create a key. **The secret is shown once** — copy it immediately.

### 3a. One-click Claude Desktop extension (recommended — no terminal, no Node.js)

Download [`bridgistic.mcpb`](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/releases/latest/download/bridgistic.mcpb), double-click it, and paste your site URL, key ID, and secret when Claude Desktop prompts (the secret is stored securely by the app — no config files, no terminal). Details: [docs/CLAUDE_DESKTOP.md](docs/CLAUDE_DESKTOP.md).

### 3b. Or install in Claude Code

```
/plugin marketplace add Shubochandrosarker/bridgistic-claude-marketplace
/plugin install bridgistic@bridgistic-marketplace
```

Then set your connection in the shell where you run Claude Code:

```bash
export BRIDGISTIC_SITE_URL="https://example.com"
export BRIDGISTIC_KEY_ID="your_key_id"
export BRIDGISTIC_KEY_SECRET="your_key_secret"
```

Requires Node.js 20+. Details: [docs/CLAUDE_CODE.md](docs/CLAUDE_CODE.md).

Also available via the [MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.shubochandrosarker/bridgistic`, and on npm:

```bash
npx bridgistic-mcp-server
```

### 3c. Or set up Claude Desktop manually

Clone this repo and build the server once:

```bash
git clone https://github.com/Shubochandrosarker/bridgistic-claude-marketplace.git
cd bridgistic-claude-marketplace
npm install && npm run build
```

Add this to your Claude Desktop config (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "bridgistic": {
      "command": "node",
      "args": [
        "/absolute/path/to/bridgistic-claude-marketplace/mcp-server/dist/index.js"
      ],
      "env": {
        "BRIDGISTIC_SITE_URL": "https://example.com",
        "BRIDGISTIC_KEY_ID": "your_key_id",
        "BRIDGISTIC_KEY_SECRET": "your_key_secret"
      }
    }
  }
}
```

Restart Claude Desktop. Details: [docs/CLAUDE_DESKTOP.md](docs/CLAUDE_DESKTOP.md). The **Bridgistic → Claude Setup** page also generates this config for you, and **Bridgistic → Export Package** downloads it as a ready-made zip.

### 4. Test the connection

- In WP Admin: **Bridgistic → Claude Setup → Step 5 → Run test**, or open **Bridgistic → Health Check** for 16 diagnostics with fixes.
- In Claude: ask it to run `bridgistic_get_site_info` (read-only). Then check **Bridgistic → Logs** — the request should be there.

### Troubleshooting

Run **Bridgistic → Health Check** first — it detects blocked REST APIs, WAF interference, clock drift, permalink problems, and more, each with a fix. Full guide: [plugins/bridgistic/package/TROUBLESHOOTING.md](plugins/bridgistic/package/TROUBLESHOOTING.md).

---

## Security model

- **HMAC-SHA256 signed requests** — the secret never travels on the wire; a timestamp window (±300s) plus single-use nonces block replays.
- **Scoped keys** — each key carries an explicit permission set (`posts:read`, `db:write`, …) enforced server-side on every call. Presets: Read-only, Content Manager, Safe Admin, Developer Mode.
- **Approvals** — keys can require human sign-off; destructive operations pause in a queue you decide on in WP Admin.
- **Snapshots** — automatic reversible captures before destructive writes; one-call rollback.
- **Secrets at rest** — encrypted (libsodium / AES-256-GCM), shown exactly once at creation, never logged. Rotate any time.
- **Dangerous tools** (`bridgistic_execute_php`, `bridgistic_db_query`, filesystem writes) require developer scopes and pass through dry-run/approval/snapshot guards. Use Developer Mode only on sites you control.

Full details: [docs/SECURITY.md](docs/SECURITY.md). Found a vulnerability? Please report it privately to support@wordpressistic.com — do not open a public issue.

## Repo layout

```
.claude-plugin/marketplace.json    Claude Code marketplace manifest
plugins/bridgistic/                Claude Code plugin (manifest, mcp.json, pre-built server, setup package)
mcp-server/                        MCP server source (TypeScript)
wordpress-plugin/bridgistic/       WordPress plugin
docs/                              Setup, security, free-vs-paid, roadmap
scripts/                           validate / package / desktop-package tooling
```

## Commands

```bash
npm install              # once
npm run build            # install + compile mcp-server, regenerate plugin server bundle
npm run validate         # manifest + structure + secret-scan checks
npm run package          # dist/bridgistic-claude-package.zip + dist/bridgistic-wordpress-plugin.zip
npm run desktop:package  # dist/bridgistic-desktop-package.zip (.mcpb-ready layout)
npm test                 # MCP server contract + integration tests
```

## Contributing

Issues and PRs are welcome for the free version: bug fixes, docs, health checks, translations, and setup UX. Ground rules:

1. **Never commit secrets** — `npm run validate` scans for them.
2. Don't weaken the security path (HMAC, scopes, approvals, snapshots) — hardening PRs are very welcome.
3. WordPress code follows WordPress coding standards (nonces, capability checks, sanitize/escape everything, prefixed names).
4. Paid/SaaS features are out of scope for this repo.

## Free vs paid direction

**Free = the local secure bridge** (this repo, complete and maintained). **Paid = Bridgistic SaaS**: skills, cloud connector, agencies, automation. Read [docs/FREE_VS_PAID.md](docs/FREE_VS_PAID.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## License

GPL-2.0-or-later. © [WordPressistic](https://wordpressistic.com) / Shuvo Sarker.
