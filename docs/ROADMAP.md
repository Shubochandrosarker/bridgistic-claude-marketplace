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

## Cloud connector (`cloud/`) — in progress, not yet deployed

`mcp.wpistic.cloud`: a hosted, multi-tenant MCP relay so connecting is "paste
one URL, approve in your own WP admin" — no local server, no Node.js, no
copy-pasted secrets. The WordPress side (a small OAuth 2.1 authorization
server, `includes/class-oauth.php` + the hidden consent screen) and the
Cloudflare Worker (`cloud/`, built on `agents/mcp` +
`@cloudflare/workers-oauth-provider`) are both written and pass their local
checks (PHP lint, `tsc --noEmit`, a real `wrangler deploy --dry-run` build),
but neither has been deployed or tested against live infrastructure yet.
Not linked from the Claude Setup wizard until that happens. See `cloud/README.md`
for exact deployment steps and the security review this needs before any
public rollout.

## Later (1.x)

- WordPress.org plugin directory submission
- Multisite network admin support
- More built-in manual playbooks (community-suggested, safety-reviewed)
- Optional webhook notifications for pending approvals (email/Slack)
- Extend the cloud connector's one-URL, OAuth-based connect flow to other MCP-capable AI clients beyond Claude

## Explicit non-goals for this repo

- AI skills marketplace and SEO/AIO/Schema skills (SaaS)
- Billing, team permissions, white-label, agency dashboards (SaaS)

Suggestions welcome via [GitHub issues](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/issues).
