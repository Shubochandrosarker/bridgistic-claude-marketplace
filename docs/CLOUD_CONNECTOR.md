# Cloud connector status (`mcp.wpistic.cloud`)

**Status: deployed, private beta. Not linked from the plugin UI, not publicly announced.**

This page is the source of truth for where the hosted, multi-tenant MCP relay actually stands —
`cloud/README.md` and `docs/ROADMAP.md` describe the design; this page tracks the live deployment.

## What's actually live

- Cloudflare Worker `bridgistic-cloud` is deployed and running the code in `cloud/src/`.
- D1 database `bridgistic-cloud` exists, with the `tenants` table already migrated
  (`migrations/0001_init.sql` applied).
- KV namespace `OAUTH_KV` exists (used by `@cloudflare/workers-oauth-provider` for its own
  grant/token/client storage).
- `cloud/wrangler.toml` has the real resource IDs for both of the above — no more
  `REPLACE_WITH_REAL_*` placeholders.
- A manual-dispatch CI workflow (`.github/workflows/deploy-cloud.yml`) can redeploy Worker code
  changes once a repo admin adds the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets
  (Settings → Secrets and variables → Actions). Until those secrets exist it's a safe no-op.
- `cloud/` has an automated test suite (`cloud/test/`, run via `npm test`) covering the encryption,
  PKCE, tenant registry, tenant storage, request signing, and WordPress OAuth client logic.

## What still needs a human to confirm (not checkable from this environment)

Two things could not be verified programmatically — this sandbox's network egress policy blocks
direct requests to `mcp.wpistic.cloud`, and secret *values* are never readable via the Cloudflare
API, only whether a binding exists:

1. **`TENANT_ENC_KEY` secret is actually set on the Worker.** If it isn't, every request that
   touches a tenant row will throw (`crypto.ts` requires a 32-byte key). Check with:
   ```bash
   cd cloud && wrangler secret list
   ```
   If `TENANT_ENC_KEY` isn't listed: `wrangler secret put TENANT_ENC_KEY` and paste the output of
   `openssl rand -base64 32`. **If a key already exists and you're not sure it's the same one used
   originally, do not overwrite it** — every already-connected tenant's `key_secret_enc` was
   encrypted with the original key, and overwriting it locks those tenants out permanently (they'd
   need to reconnect). Only set a fresh one if this is truly a first-time setup.

2. **The `mcp.wpistic.cloud` DNS route is actually resolving to this Worker.** `wrangler.toml`
   declares the route (`mcp.wpistic.cloud/*` on zone `wpistic.cloud`), which requires the
   `wpistic.cloud` zone to be on this Cloudflare account with the route attached. Confirm from a
   machine that isn't behind this sandbox's egress policy:
   ```bash
   curl -i https://mcp.wpistic.cloud/mcp
   ```
   A `401`/`426`/JSON-RPC-shaped response means it's reachable and answering as an MCP endpoint. A
   TLS/DNS failure means the route or zone isn't attached yet — check
   **Cloudflare dashboard → Workers & Pages → bridgistic-cloud → Settings → Domains & Routes**.

## Before this goes from "private beta" to "linked in the wizard / publicly announced"

These are unchanged from `cloud/README.md`'s own pre-launch checklist, repeated here because this
is the page a maintainer will actually check before flipping the switch:

1. A real end-to-end test: WordPress OAuth consent → tenant provisioned in D1 → a real MCP client
   (Claude's remote connector is the easiest to test with today) successfully calls a tool.
2. An independent security review of the OAuth relay and the D1 tenant store — this Worker holds a
   live Bridgistic credential for every connected WordPress site.
3. Load/abuse testing — there is currently **no rate limiting at the Worker level**. WordPress's
   own per-key rate limit still applies once a request reaches it, but nothing stops one
   compromised OAuth access token from hammering `/mcp` before that point.
4. **The free-vs-paid decision.** `docs/FREE_VS_PAID.md` currently promises free-plugin users there
   is no remote/cloud connector, and reserves it for a paid SaaS tier — a decision that hasn't been
   made yet for this specific deployment. Nothing in this repo currently surfaces the cloud
   connector to free-plugin users (the Claude Setup wizard doesn't link it, and `FREE_VS_PAID.md`
   hasn't been changed), so there's no contradiction today — but publishing docs like
   [CHATGPT_SETUP.md](CHATGPT_SETUP.md) more widely, or adding a wizard entry point, means deciding
   this first.

## Testing it yourself in the meantime

Nothing stops you from trying the connector today even while it's unlinked — the WordPress side
(`Bridgistic\Oauth`, the hidden consent screen at `admin.php?page=bridgistic-oauth-authorize`) has
been live since it was built. To try it with Claude's remote connector: Settings → Connectors →
Add custom connector → `https://mcp.wpistic.cloud/mcp` → approve in your own WP admin when
prompted. See [CHATGPT_SETUP.md](CHATGPT_SETUP.md) for what the same flow looks like once ChatGPT
support is published.
