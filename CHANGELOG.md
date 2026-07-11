# Changelog

All notable changes to the Bridgistic free public distribution.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

Multi-client, multi-site setup, and cloud connector hardening.

### Added

- **Codex CLI and Gemini CLI as first-class connection types** in the Claude Setup wizard (step 1
  choices + step 4 config tabs), generating `~/.codex/config.toml` and `~/.gemini/settings.json`
  snippets that launch the published `bridgistic-mcp-server` npm package via `npx` — no clone or
  build step. `ConfigGenerator::codex()` / `ConfigGenerator::gemini_cli()`.
- **Docs for connecting other AI clients**: `docs/CODEX_SETUP.md`, `docs/GEMINI_SETUP.md`,
  `docs/CHATGPT_SETUP.md` (private beta, remote-only), and `docs/CONNECT_OTHER_AI.md` (a hub
  covering both multi-client and multi-WordPress-site setups). Linked from the README and the
  Claude Setup wizard.
- **`cloud/` test suite** — 73 tests (`node --test`, zero new test-framework dependency besides
  `tsx` for running TypeScript directly) covering tenant credential encryption, PKCE, the tenant
  registry, D1 tenant storage, HMAC request signing, and the WordPress OAuth client. Wired into CI.
- **`docs/CLOUD_CONNECTOR.md`** — live-status tracking for the `mcp.wpistic.cloud` deployment
  (what's actually provisioned vs. what still needs manual confirmation) and the checklist before
  it moves from private beta to generally available.
- **`.github/workflows/deploy-cloud.yml`** — manual-dispatch CI workflow to redeploy the `cloud/`
  Worker via `wrangler deploy`, gated on `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` repo
  secrets (safe no-op until a repo admin adds them). Independent of `ci.yml`/`release.yml`.

- **Per-IP rate limiting on the cloud Worker** (`cloud/src/rate-limit.ts`, wired in `index.ts`) —
  120 req/min/IP on `/mcp`, 20 req/min/IP on the OAuth handshake routes, backed by a KV
  fixed-window counter. Closes the "no rate limiting at the Worker level" gap tracked in
  `docs/CLOUD_CONNECTOR.md`. 4 new tests (`cloud/test/rate-limit.test.ts`, suite now 77 tests).
- **"Bridgistic Cloud" page** (WP Admin, tagged Beta in the nav) — the cloud connector's OAuth flow
  was previously live in code but reachable only via a deep link initiated from the Worker; this
  page makes it discoverable, shows the connector URL to paste into an AI client, and states its
  beta/no-security-review-yet status plainly. The OAuth consent screen itself carries the same
  warning directly on the Allow/Deny screen.
- **First-activation redirect** — activating the plugin now sends the admin straight to Claude
  Setup on their next page load (`Plugin::activate()` sets a short-lived transient,
  `Admin\Controller::maybe_redirect_after_activation()` consumes it), skipped for bulk activations.
- **Live "client connected" check in Claude Setup step 5** — previously "Run test" only confirmed
  the server-side pipeline; step 5 now also polls (`bridgistic_poll_client_connected`) until the
  AI client makes its first real request with the new key, and flips to a connected state
  automatically instead of requiring a manual trip to the Logs page.
- **Per-field copy buttons for the Desktop Extension panel** — Site URL, Key ID, and Secret each
  get their own one-click copy button instead of one plain-text block to select from by hand.
- **`docs/CONNECT_BRIDGISTIC.md`** — a single non-technical, step-by-step connect guide
  (install → key → connect → verify → troubleshoot → FAQ) consolidating what was previously spread
  across `INSTALL.md`, `WORDPRESS_SETUP.md`, `CLAUDE_DESKTOP.md`, `CONNECT_OTHER_AI.md`, and
  `CLOUD_CONNECTOR.md`. Linked from the README.

### Changed

- **Admin dashboard now defaults to light theme** (was dark-by-default); dark now requires an
  explicit toggle or an OS dark preference. Same toggle, same tokens, direction inverted.
- **The cloud connector is free, public beta** — `docs/FREE_VS_PAID.md`'s "Remote MCP connector"
  row changed from "No" (free) to "Public beta"; the in-plugin Premium Features page no longer
  lists it as an SaaS-exclusive locked feature.
- `cloud/wrangler.toml` now has real Cloudflare resource IDs (D1 database, KV namespace) instead
  of placeholders — the Worker, database, and KV namespace were already provisioned outside of
  this repo's history; the committed config now matches the live deployment.
- Fixed a stale `Plugin URI` in `bridgistic.php` that still pointed at the deprecated `bridgistic`
  repo instead of `bridgistic-claude-marketplace`.

### Notes

- The `mcp.wpistic.cloud` cloud connector is now a **public beta**, linked from WP Admin
  (Bridgistic Cloud) and free to use. It has **not** had an independent third-party security
  review yet — this is stated explicitly on the Bridgistic Cloud page and the OAuth consent screen
  so users can make an informed call. See `docs/CLOUD_CONNECTOR.md` for full status and the
  remaining checklist (end-to-end test against a live client, the security review).
- Multi-site support (`BRIDGISTIC_CONNECTIONS`) is unchanged in behavior; it's now documented in
  one place (`docs/CONNECT_OTHER_AI.md`) instead of being scattered across per-client docs.

## [1.1.1] — 2026-07-04

Patch: corrected MCP Registry namespace casing (io.github.Shubochandrosarker) in the npm package metadata so registry ownership validation passes. No functional changes.

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
