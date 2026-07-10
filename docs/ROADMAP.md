# Roadmap — free public version

What's planned for this repository. SaaS plans live elsewhere; this roadmap only covers the free local bridge.

## Shipped (1.0.0)

- Claude Code plugin marketplace with pre-built server bundle
- Local MCP server: 43 tools, stdio (+ loopback-only HTTP for dev), env validation, leveled logging
- WordPress plugin: HMAC auth, scoped keys, approvals, snapshots, audit log, playbooks, schedules
- Admin dashboard: guided Claude Setup wizard, Keys & Scopes, Health Check (16 diagnostics), Logs, Snapshots, Playbooks, Export Package, Settings
- Export package zip with configs + install scripts
- Validation/packaging tooling and secret scanning

## Shipped (1.1.0)

- **Claude Desktop Extension (`.mcpb`)** — one-click install, validated against the official MCPB schema; site URL / key ID / secret collected via `user_config` (secret stored by Claude Desktop)
- **npm-publishable server** (`npx bridgistic-mcp-server`) with `prepublishOnly` build
- **MCP Registry listing** (`server.json`, `io.github.shubochandrosarker/bridgistic`) published automatically from CI via GitHub OIDC
- **Release automation** — one tag push builds, tests, validates, creates the GitHub release with all assets, publishes npm + registry
- CI on every PR: build, tests, marketplace validation + secret scan, PHP lint

## Next (1.2)

- Submission to Anthropic's Claude Desktop extension directory (in-app browsing) — needs a published privacy policy (`docs/PRIVACY.md`, done) plus the interest-form submission itself
- Extension signing (`mcpb sign`) with a project certificate
- Health Check: PHP zip extension check, object-cache nonce-storage warning, downloadable report file
- i18n: complete translator-ready strings and a `languages/` refresh
- A Claude Code onboarding skill that collects site URL / key / secret conversationally instead of requiring hand-edited shell env vars (closes the GUI gap with the Desktop `.mcpb` path)

## Cloud connector (`cloud/`) — deployed, private beta

`mcp.wpistic.cloud`: a hosted, multi-tenant MCP relay so connecting is "paste
one URL, approve in your own WP admin" — no local server, no Node.js, no
copy-pasted secrets. The WordPress side (a small OAuth 2.1 authorization
server, `includes/class-oauth.php` + the hidden consent screen) and the
Cloudflare Worker (`cloud/`, built on `agents/mcp` +
`@cloudflare/workers-oauth-provider`) are both written, have an automated
test suite (`cloud/test/`, 73 tests), and the Worker + its D1 database + KV
namespace are provisioned and deployed. It is **not yet linked from the
Claude Setup wizard or publicly announced** — see
[`docs/CLOUD_CONNECTOR.md`](CLOUD_CONNECTOR.md) for exactly what's
confirmed live vs. what still needs a manual check (the `TENANT_ENC_KEY`
secret, the DNS route), and the checklist (end-to-end test, security
review, rate limiting, and the free-vs-paid decision in
`docs/FREE_VS_PAID.md`) before it moves beyond private beta.

## Multi-client MCP support — local clients shipped, remote-only clients in beta

Bridgistic speaks standard MCP, so it isn't Claude-only. **Shipped**: the
Claude Setup wizard now generates ready-to-paste configs for **OpenAI Codex
CLI** and **Gemini CLI** (both run Bridgistic locally, same as Claude
Desktop/Code — see `docs/CODEX_SETUP.md` / `docs/GEMINI_SETUP.md`) in
addition to Claude. **Beta**: **ChatGPT** only supports remote MCP
connectors, so it needs the cloud connector above — see
`docs/CHATGPT_SETUP.md` for the flow once that opens up. The consumer
Gemini app and Gemini Enterprise have their own, more restrictive
connector models (see `docs/GEMINI_SETUP.md`) and aren't currently
self-serve targets.

## Later (1.x)

- WordPress.org plugin directory submission
- Multisite network admin support
- More built-in manual playbooks (community-suggested, safety-reviewed)
- Optional webhook notifications for pending approvals (email/Slack)
- Rate limiting at the cloud connector's Worker level (currently relies only
  on WordPress's own per-key rate limit once a request reaches it)
- A WP-admin UI for building/editing a multi-site `connections.json` (today
  it's a hand-edited file — see `docs/CONNECT_OTHER_AI.md`)

## Explicit non-goals for this repo

- AI skills marketplace and SEO/AIO/Schema skills (SaaS)
- Billing, team permissions, white-label, agency dashboards (SaaS)

Suggestions welcome via [GitHub issues](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/issues).
