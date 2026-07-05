import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { BridgisticMcpAgent } from "./agent.js";
import defaultHandler from "./default-handler.js";

export { BridgisticMcpAgent };

/**
 * mcp.wpistic.cloud entry point. This Worker is simultaneously:
 *  - an OAuth 2.1 *server* to the AI client (Claude, ChatGPT, ...), handled
 *    by OAuthProvider itself (token/registration/metadata endpoints, PKCE,
 *    grant storage in OAUTH_KV);
 *  - an OAuth 2.1 *client* to the connecting WordPress site, handled by our
 *    own code in default-handler.ts (/authorize, /wp-callback).
 *
 * Every tool call that reaches BridgisticMcpAgent has already been through
 * OAuthProvider's Bearer-token validation - by the time init() runs on the
 * Durable Object, `this.props.tenantId` is trustworthy.
 */
export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: BridgisticMcpAgent.serve("/mcp"),
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  // AI clients hold this and use it directly against WordPress-derived
  // scopes; keep it short so a leaked client-side token has a small window.
  accessTokenTTL: 3600,
});
