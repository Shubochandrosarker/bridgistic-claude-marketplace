# Free vs Paid

The free public version is focused on the **local Claude/WordPress connection**. Advanced skills, remote hosted connectors, multi-site team management, and SaaS automation belong to the paid/private version.

That split is deliberate:

- **Free plugin = the local secure bridge.** Complete, not crippled: full HMAC auth, all scopes, approvals, audit logs, snapshots, manual playbooks, guided setup, health diagnostics, export packages. It's everything an individual needs to connect Claude to their own site safely.
- **Paid SaaS = skills, cloud connector, agencies, automation.** The layer on top for teams and businesses running many sites.

## Feature comparison

| Feature | Free Plugin | Paid SaaS |
|---|---|---|
| Local Claude Desktop setup | Yes | Yes |
| Claude Code setup | Yes | Yes |
| HMAC keys | Yes | Yes |
| Scopes | Yes | Yes |
| Audit logs | Basic | Advanced |
| Snapshots | Limited | Advanced |
| Manual playbooks | Basic | Advanced |
| Scheduled playbooks | Limited | Full |
| Skills marketplace | No | Yes |
| SEO/AIO/Schema skills | No | Yes |
| Remote MCP connector | No | Yes |
| Multi-site agency dashboard | No | Yes |
| Team permissions | No | Yes |
| Usage billing | No | Yes |
| White-label | No | Yes |

## What "Basic" and "Limited" mean concretely

- **Audit logs (Basic):** every request logged with key/action/status/IP and hashed params, 90-day retention, filterable in WP Admin. *Advanced* adds long-term history, analytics, and export.
- **Snapshots (Limited):** automatic pre-destructive snapshots plus manual ones, capped at 50 stored, one-click restore. *Advanced* adds full history, retention policies, and rollback analytics.
- **Manual playbooks (Basic):** four built-in safe routines plus any playbooks Claude saves; run from WP Admin or via MCP tools.
- **Scheduled playbooks (Limited):** cron-driven scheduling of saved playbooks is included; the SaaS adds managed schedules, monitoring, and reporting.

## Promises to free users

1. The free plugin is not a demo — the local bridge and its security layer are fully functional and maintained here, in public.
2. Locked SaaS features are **display-only** in the free plugin: no billing code, no account system, no nag walls.
3. Security fixes always land in the free version.
