=== Bridgistic ===
Contributors: shuvoskr
Tags: mcp, ai, claude, automation, rest-api
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 8.0
Stable tag: 1.1.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free local MCP bridge for Claude: connect Claude Desktop and Claude Code to WordPress with signed requests, scoped keys, approvals, audit logs, and snapshots.

== Description ==

Bridgistic is the WordPress side of an MCP (Model Context Protocol) bridge. It lets an AI agent — Claude, Claude Cowork, or any MCP client — operate a real WordPress site safely, instead of handing over a full-admin Application Password and hoping for the best.

Every request is HMAC-signed and tied to a least-privilege key. Destructive actions can be previewed (dry-run), held for human approval, and are snapshotted first so any change is one call away from a rollback. Usage is metered per key, and playbooks can run unattended on a schedule.

**This is the free local version** — the complete secure bridge for connecting Claude to your own sites. Advanced AI skills, a remote cloud connector, multi-site team dashboards, and white-label options belong to Bridgistic SaaS (separate product).

= What you get =

* HMAC-signed REST API with scoped, least-privilege keys (no Application Password).
* Structured tools: posts, media, users, options (allowlisted), plugins, files.
* Dry-run + human approval queue for destructive operations.
* Automatic snapshot before every destructive write, with one-call rollback.
* Full audit log of every request.
* Per-key rate limiting and basic usage metering.
* Per-site memory and reusable, parameterised playbooks.
* Scheduled playbooks that run unattended via cron.
* A server-side PHP sandbox: executable PHP can only be written to one quarantined directory.

= Part of the WordPressistic Galaxy =

Bridgistic is one of the WordPressistic ecosystem products. It works standalone on any WordPress 6.4+ / PHP 8.0+ site.

== Installation ==

1. Upload the `bridgistic` folder to `/wp-content/plugins/`, or install the zip via Plugins → Add New → Upload.
2. Activate the plugin.
3. Go to **Bridgistic → Connect** and mint a scoped key. Copy the secret — it is shown once.
4. Configure the Bridgistic MCP server with your site URL, key id, and secret.

For reliable scheduled playbooks, disable WP-Cron and run a real system cron against `wp-cron.php` (the Schedules screen shows the exact line).

== Frequently Asked Questions ==

= Is this safe to run on a live site? =

That is the entire design goal. Keys are least-privilege, destructive ops can require approval and are snapshotted first, and you have a full audit log plus one-call rollback. Start with a read-only key and widen scopes as you build trust.

= Does it need an Application Password? =

No. Bridgistic uses its own HMAC-signed, scoped keys instead of a full-admin Application Password.

= Where can the agent write PHP? =

Only inside a single quarantined sandbox directory under uploads, with direct web execution blocked. PHP cannot be written anywhere WordPress autoloads from.

== Changelog ==

= 1.0.0 =
* Initial public release.

== Upgrade Notice ==

= 1.0.0 =
First public release.
