# Changelog

All notable changes to the Bridgistic free public distribution.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [1.1.0] — 2026-07-03

One-click connection and publishing release.

### Added

- **Claude Desktop Extension (`bridgistic.mcpb`)** — real MCPB bundle validated against the official schema (`@anthropic-ai/mcpb`). Double-click to install; Claude Desktop prompts for site URL, key ID, and secret via `user_config` (the secret is stored by the app, marked `sensitive`). Built by `npm run desktop:package`; branded 512px icon included.
- **npm publishing** — `bridgistic-mcp-server` is publish-ready (`files` allowlist, `prepublishOnly` build+typecheck, `mcpName` field, npm-facing README with the registry ownership marker).
- **MCP Registry listing** — `server.json` (`io.github.shubochandrosarker/bridgistic`, 2025-09-29 schema) so the server appears in the official registry Claude clients can browse.
- **Release automation** (`.github/workflows/release.yml`) — pushing a `v*` tag: verifies all manifests match the tag, builds, tests, validates, creates the GitHub release with `bridgistic.mcpb` + both zips, publishes to npm (when `NPM_TOKEN` is configured) and then to the MCP Registry via GitHub OIDC (no secret needed).
- **CI** (`.github/workflows/ci.yml`) — build, MCP tests, marketplace validation + secret scan, package builds, PHP lint on every PR.
- Claude Setup wizard: **Desktop Extension** connection type is now live — download button for the latest `.mcpb` plus paste-ready values panel.
- Validator: checks `mcpb/manifest.json` (user_config wiring, sensitive secret), `server.json` (name format, npm identifier match, README `mcp-name` marker), and version consistency across all six manifests.

### Changed

- Version 1.1.0 across marketplace, plugin, server, extension, and registry manifests; `docs/CLAUDE_DESKTOP.md` now leads with the one-click path; roadmap updated.

## [1.0.0] — 2026-07-03

First public release of the free Bridgistic distribution.

### Added

**Claude Code marketplace**
- `.claude-plugin/marketplace.json` + `plugins/bridgistic` plugin (manifest, `mcp.json`, README)
- Pre-built self-contained MCP server bundle (`plugins/bridgistic/server/index.js`) so `/plugin install` needs no build step
- Setup package: example Claude Desktop/Code configs, multi-site `connections.example.json`, Windows/macOS/Linux install helpers, troubleshooting guide

**MCP server** (`mcp-server/`)
- 43 WordPress tools over stdio (loopback-guarded HTTP for local dev)
- `BRIDGISTIC_SITE_URL` / `BRIDGISTIC_TRANSPORT` / `BRIDGISTIC_LOG_LEVEL` env names (legacy names still accepted)
- Startup configuration validation with actionable stderr messages; `.env.example`
- esbuild bundling (`npm run bundle`), type-check validation, contract + integration tests

**WordPress plugin** (`wordpress-plugin/bridgistic/`)
- New WordPressistic-branded admin dashboard (modular `admin/` layer, scoped assets, dark/light themes, reduced-motion support)
- Claude Setup: 5-step wizard (client → permission preset → key → config → live pipeline test)
- Keys & Scopes: scope badges, rotate-secret-in-place, soft revoke + re-enable, per-scope advanced creation
- Health Check: 16 diagnostics (REST, namespace, WAF, HMAC self-test, SSL, permalinks, versions, sandbox, tables, scopes, config, time drift) with score and secret-free debug report
- Logs: filterable audit trail (read/write/approval/failed/security/developer)
- Snapshots: manual creation, restore with warning, free-tier cap (50)
- Playbooks: 4 built-in manual routines, saved-playbook runner (dry-run supported), schedule management
- Export Package: zip with configs + install scripts; secrets embedded only within the 2-minute post-creation window and with explicit confirmation
- Premium Features screen: display-only preview of Bridgistic SaaS (no billing/unlock code)
- Additive security-layer methods: `KeyStore::set_enabled()`, `KeyStore::rotate_secret()`, `AuditLog::query()/count()/latest()`

**Tooling & docs**
- `npm run validate` (structure, manifests, secret scan), `npm run package`, `npm run desktop:package` (`.mcpb`-ready layout, honestly labeled as draft)
- Docs: INSTALL, CLAUDE_DESKTOP, CLAUDE_CODE, WORDPRESS_SETUP, SECURITY, FREE_VS_PAID, ROADMAP

### Changed
- Key creation UI no longer exposes billing tiers (free version keeps plain rate limits); readme repositioned for the free local version
- Example connection files genericized (`example.com` hosts only)

### Security
- No SaaS/remote-connector code paths included; HMAC, scope, approval, and snapshot logic unchanged from the audited core
