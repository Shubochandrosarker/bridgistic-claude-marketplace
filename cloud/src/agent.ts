import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTenant } from "./tenants-db.js";
import { TenantRegistry } from "./tenant-registry.js";
import { registerTools } from "./tools/register.js";
import { SERVER_NAME, SERVER_VERSION } from "./constants.js";

export interface Env {
  DB: D1Database;
  TENANT_ENC_KEY: string;
}

/** Props threaded through from the OAuth access token (see default-handler.ts). */
type Props = { tenantId: string };

/**
 * One Durable Object instance per MCP session. `props.tenantId` comes from
 * the OAuth access token that OAuthProvider already validated before this
 * agent is ever invoked - by the time init() runs, the caller is proven to
 * hold a token scoped to exactly this tenant, nothing else to check here.
 */
export class BridgisticMcpAgent extends McpAgent<Env, unknown, Props> {
  server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  async init(): Promise<void> {
    const tenantId = this.props?.tenantId;
    if (!tenantId) {
      // Shouldn't happen - OAuthProvider only calls the apiHandler with a
      // validated token, and every grant this Worker issues carries a
      // tenantId. Fail loudly rather than silently expose no tools.
      throw new Error("No tenant bound to this session (missing OAuth props).");
    }

    const tenant = await getTenant(this.env.DB, this.env.TENANT_ENC_KEY, tenantId);
    if (!tenant) {
      throw new Error("This connection's WordPress site is no longer known to the cloud connector. Reconnect from WP Admin -> Bridgistic -> Claude Setup.");
    }

    const registry = new TenantRegistry({
      alias: "default",
      siteUrl: tenant.siteUrl,
      keyId: tenant.keyId,
      secret: tenant.keySecret,
    });

    registerTools(this.server, registry);
  }
}
