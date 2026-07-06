# Test Coverage Analysis

This document surveys current test coverage across this repo's components — the
hosted Cloudflare Worker relay (`cloud/`), the WordPress plugin (`wordpress-plugin/
bridgistic/`), the MCP server (`mcp-server/`), the packaged Claude plugin (`plugins/
bridgistic/`), and the build/validation scripts (`scripts/`) — and proposes concrete
areas to improve. It's a survey, not a change to behavior; no production code is
modified here.

## Current state

| Component | Test infra | Runs in CI? |
|---|---|---|
| `cloud/` (Cloudflare Worker) | **None** — no test script, no test files | No |
| `wordpress-plugin/bridgistic/` (PHP) | `tests/hmac-roundtrip.test.php` (identical to the sibling `bridgistic` repo) | **No** — `ci.yml`'s PHP step only runs `php -l` (lint); the test file exists but is never executed |
| `mcp-server/` | `evals/contract.test.mjs` + `evals/integration.test.mjs` | Yes, via root `npm test` |
| `plugins/bridgistic/` | None (mostly generated build output) | Indirectly, via the packaging steps exiting 0 |
| `scripts/` | None | Indirectly, via `ci.yml` running `build`/`validate`/`package`/`desktop:package` as an implicit smoke test |

**The most actionable finding**: `wordpress-plugin/bridgistic/tests/hmac-roundtrip.test.php`
already exists and is a working test — it's just not wired into this repo's CI. The
sibling `bridgistic` repo's CI runs the equivalent test; this repo's `ci.yml` PHP step
only does `find wordpress-plugin -name '*.php' ... | xargs php -l`. Adding one line
(`php wordpress-plugin/bridgistic/tests/hmac-roundtrip.test.php`) closes this gap
immediately.

## `cloud/` — hosted multi-tenant relay (highest priority, zero tests today)

This Worker is a materially bigger security surface than a plain local MCP server: it
runs **two** independent OAuth/PKCE flows (server-side to AI clients via
`@cloudflare/workers-oauth-provider`, and hand-rolled client-side to each user's
WordPress site via `default-handler.ts`/`wp-oauth-client.ts`/`pkce.ts`), encrypts and
stores per-tenant credentials at rest in D1 (`crypto.ts`, `tenants-db.ts`), and
multiplexes many tenants through one Durable Object (`agent.ts`) whose only
authorization check is `props.tenantId` — trusted implicitly because the OAuth
provider already validated the bearer token. None of this exists in a single-operator
local server reading a config file, and none of it has a single test today.

Highest-risk untested logic:

- **`tenants-db.ts`** — no test that tenant A's `id` can never resolve tenant B's
  `siteUrl`/`keySecret` (the core cross-tenant isolation guarantee); no test of the
  race where two concurrent `upsertTenant` calls for a brand-new `site_url` both mint
  fresh UUIDs and collide on the `UNIQUE(site_url)` constraint.
- **`agent.ts`** — no test that `init()` fails closed when `props.tenantId` is missing
  or `getTenant` returns null (a deleted tenant) — this is the actual authorization
  gate for every tool call.
- **`crypto.ts`** — no encrypt/decrypt roundtrip test; no test that tampered
  ciphertext is rejected (GCM auth tag) rather than silently returning corrupted
  plaintext; no test that IVs are unique per call (nonce reuse here is catastrophic).
- **`tenant-registry.ts`** — `resolve(_alias)` ignores its argument entirely; there's
  no regression test pinning that an attacker-supplied alias can never redirect a
  session to a different tenant's connection.
- **`pkce.ts`** — no test against RFC 7636 S256 vectors.
- **`default-handler.ts`** — no test of expired/replayed `flow_id`/`wpState`; no test
  that a `wpState` is single-use; no test of `cleanSiteUrl` rejecting non-https or
  malformed input.
- **`services/signer.ts`** — no pinned canonical-string/HMAC vector; a silent drift
  here would weaken signed requests to every tenant's WordPress site simultaneously.
- **`services/wp-client.ts`** — no test of query-string stripping before signing, or of
  timeout/network-error handling.
- **`tools/helpers.ts`** — `withGuard`'s `!== undefined` check (so `force:false` is
  still forwarded) is untested — a regression here would silently disable "preview"
  mode on destructive tools.

Note: `cloud/src/tools/*.ts` is byte-identical to `mcp-server/src/tools/*.ts` in this
repo, and near-identical to `bridgistic-mcp-server/src/tools/*.ts` in the sibling
repo — any bug in guard-parameter forwarding or route construction is currently
tripled across three deployed artifacts.

### Proposed test additions (priority order)

1. `tenants-db.ts`: cross-tenant isolation — `getTenant(tenantA)` never returns
   tenant B's row.
2. `agent.ts`: `init()` fails closed on missing `tenantId` or a deleted tenant.
3. `crypto.ts`: encrypt→decrypt roundtrip; tampered ciphertext throws; two encryptions
   of the same plaintext produce different IV/ciphertext.
4. `services/signer.ts`: known-vector test for the canonical string + HMAC output.
5. `pkce.ts`: matches an RFC 7636 S256 test vector.
6. `default-handler.ts`: unknown/expired `wpState` → 400; a `wpState` is redeemable
   exactly once; `cleanSiteUrl` rejects non-https/malformed input.
7. `tenant-registry.ts`: `resolve()` always returns the one bound connection
   regardless of alias — pins single-tenant behavior against future multi-site
   refactors.
8. `tenants-db.ts`: re-upserting the same `site_url` updates the existing row instead
   of erroring or forking identity.
9. `services/wp-client.ts`: query string stripped before signing; hung fetch aborts at
   the timeout with a `"timeout"` error code, not an unhandled hang.
10. `tools/helpers.ts`: `withGuard` forwards `force:false`/`dry_run:false` explicitly.

**Tooling recommendation**: introduce `vitest` with `@cloudflare/vitest-pool-workers` —
the Cloudflare-recommended setup, which runs tests inside real `workerd` with actual
D1/KV/Durable Object bindings via Miniflare, so OAuth-flow and tenant-isolation tests
can be true integration tests rather than mocks.

## `wordpress-plugin/bridgistic/` — PHP plugin (diverged from the sibling repo)

Beyond the CI gap noted above, this variant adds OAuth-specific files with **zero**
coverage:

- **`includes/class-oauth.php`** (PKCE-based OAuth 2.1 authorize/redeem for the cloud
  connector) and **`includes/rest/class-oauth-controller.php`** (the public,
  non-HMAC `/oauth/token` REST route) — no test of redirect_uri host allowlisting,
  PKCE S256 challenge/verifier matching, single-use code consumption, wrong-`client_id`
  rejection, or missing-param handling. This is new, internet-facing, non-HMAC auth
  surface — proportionally higher risk than the rest of the plugin.
- **`class-key-store.php`**'s added `set_enabled()`/`rotate_secret()` methods (not
  present in the sibling repo) aren't exercised by the existing test.

### Proposed test additions

1. Wire `php wordpress-plugin/bridgistic/tests/hmac-roundtrip.test.php` into `ci.yml`
   (regression fix, not new test-writing — highest priority, lowest effort).
2. New test for `Oauth::issue_code`/`redeem_code`: valid PKCE round-trip, wrong
   `code_verifier` rejected, wrong `client_id` rejected, code reuse rejected,
   `redirect_uri` host-allowlist enforced both at issue and redeem time.
3. `KeyStore::set_enabled()`/`rotate_secret()`: disabled key fails auth; rotated
   secret invalidates the old one and validates the new one.
4. Contract-level test for `/oauth/token`: missing params, wrong `grant_type`, and
   success-shape assertions.

## `mcp-server/` — MCP server variant

`contract.test.mjs`/`integration.test.mjs` mirror the sibling repo's tests and spawn
`dist/index.js` — but the artifact actually shipped in the desktop package and
`.mcpb` is `plugins/bridgistic/server/index.js`, the esbuild CJS bundle produced by
the `bundle` script. No test ever runs that bundled file directly, so an ESM→CJS
transform break (module resolution, `require` shims) would ship without any test
catching it.

### Proposed test additions

1. Smoke test that spawns `plugins/bridgistic/server/index.js` after `npm run bundle`
   (mirroring what `contract.test.mjs` does against `dist/index.js`) and asserts
   `tools/list` still succeeds.
2. CI check that `git diff --exit-code plugins/bridgistic/server/index.js` after a
   fresh `npm run build` — catches drift between the committed bundle and what current
   source would produce.

## `plugins/bridgistic/` — packaged Claude plugin

`server/index.js` (+ its stub `package.json`) is generated build output from
`mcp-server`'s `bundle` script — **do not write tests against it directly as source**;
test the bundling step instead (see above). Everything else here —
`.claude-plugin/plugin.json`, `mcp.json`, `README.md`, and `package/*` (install
scripts, troubleshooting docs, example configs) — is hand-maintained and untested
beyond `validate-marketplace.js`'s file-existence/JSON-shape checks.

### Proposed test additions

1. A test (or CI step) that runs `package/install-macos-linux.sh` and
   `package/install-windows.ps1` against a throwaway fake Claude config, asserting
   they merge the MCP server entry correctly and back up the original file.

## `scripts/` — build & validation tooling

Root `package.json`'s `"test"` script only runs `mcp-server`'s tests; nothing here has
its own unit tests. `ci.yml` running `build`/`validate`/`package`/`desktop:package`
is an implicit "does it exit 0" smoke check, not an assertion-based test — e.g.
`validate-marketplace.js`'s own failure-detection logic (missing file, secret
pattern, version drift) is never proven to actually catch those cases, only observed
to pass against the current, presumably-clean repo state.

### Proposed test additions

1. `scripts/lib/zip.js`: write then extract/reopen a zip, assert entries and contents
   round-trip correctly.
2. `scripts/validate-marketplace.js`: construct a temp fixture tree with a missing
   required file / an embedded secret pattern / version drift, and assert the
   validator exits non-zero with the expected message for each.

## Summary of top priorities across this repo

1. **Wire up the existing PHP test in CI** — a one-line fix closing a real gap.
2. **Add any test coverage at all to `cloud/`** — it currently has none, and it's the
   component with the largest blast radius (multi-tenant OAuth + at-rest credential
   encryption).
3. **Cover the new OAuth/PKCE code** in `wordpress-plugin/bridgistic` — new,
   internet-facing, non-HMAC auth surface with zero tests.
4. **Smoke-test the shipped bundle**, not just the raw `tsc` output, in `mcp-server/`.
