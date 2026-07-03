# Roadmap — free public version

What's planned for this repository. SaaS plans live elsewhere; this roadmap only covers the free local bridge.

## Shipped (1.0.0)

- Claude Code plugin marketplace with pre-built server bundle
- Local MCP server: 43 tools, stdio (+ loopback-only HTTP for dev), env validation, leveled logging
- WordPress plugin: HMAC auth, scoped keys, approvals, snapshots, audit log, playbooks, schedules
- Admin dashboard: guided Claude Setup wizard, Keys & Scopes, Health Check (16 diagnostics), Logs, Snapshots, Playbooks, Export Package, Settings
- Export package zip with configs + install scripts
- Validation/packaging tooling and secret scanning

## Next (1.1)

- **Claude Desktop Extension (`.mcpb`)** — one-click desktop install. The layout groundwork exists (`npm run desktop:package`); shipping waits on a validated manifest against the official spec, code signing, and install-flow testing. We will not fake compatibility before that.
- Health Check: PHP zip extension check, object-cache nonce-storage warning, downloadable report file
- Setup wizard: QR/deep-link hand-off between WP Admin and the desktop app where possible
- i18n: complete translator-ready strings and a `languages/` refresh

## Later (1.x)

- npm-published server (`npx bridgistic-mcp-server`) as an alternative to the bundled file
- WordPress.org plugin directory submission
- Multisite network admin support
- More built-in manual playbooks (community-suggested, safety-reviewed)
- Optional webhook notifications for pending approvals (email/Slack)

## Explicit non-goals for this repo

- Remote/cloud MCP connector (SaaS)
- AI skills marketplace and SEO/AIO/Schema skills (SaaS)
- Billing, team permissions, white-label, agency dashboards (SaaS)

Suggestions welcome via [GitHub issues](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/issues).
