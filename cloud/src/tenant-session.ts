import { getTenant } from "./tenants-db.js";
import { TenantRegistry } from "./tenant-registry.js";
import type { SiteRegistry } from "./types.js";

export interface TenantSessionEnv {
  DB: D1Database;
  TENANT_ENC_KEY: string;
}

/**
 * Resolves an OAuth-derived tenantId to a SiteRegistry scoped to exactly
 * that tenant's WordPress site. Split out of agent.ts's init() purely so
 * it's unit-testable: agent.ts imports `agents/mcp`, which pulls in
 * Cloudflare-Workers-runtime-only globals (`cloudflare:workers`) that make
 * the module unimportable under plain `node:test` (no Miniflare in this
 * repo's toolchain) - this file has no such dependency, so the "which
 * tenant, which errors" logic is testable even though the Durable Object
 * wrapper around it isn't.
 */
export async function resolveTenantRegistry(env: TenantSessionEnv, tenantId: string | undefined): Promise<SiteRegistry> {
  if (!tenantId) {
    // Shouldn't happen - OAuthProvider only calls the apiHandler with a
    // validated token, and every grant this Worker issues carries a
    // tenantId. Fail loudly rather than silently expose no tools.
    throw new Error("No tenant bound to this session (missing OAuth props).");
  }

  const tenant = await getTenant(env.DB, env.TENANT_ENC_KEY, tenantId);
  if (!tenant) {
    throw new Error("This connection's WordPress site is no longer known to the cloud connector. Reconnect from WP Admin -> Bridgistic -> Claude Setup.");
  }

  return new TenantRegistry({
    alias: "default",
    siteUrl: tenant.siteUrl,
    keyId: tenant.keyId,
    secret: tenant.keySecret,
  });
}
