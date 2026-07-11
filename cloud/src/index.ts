import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { BridgisticMcpAgent } from "./agent.js";
import defaultHandler from "./default-handler.js";
import { isRateLimited } from "./rate-limit.js";

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
const provider = new OAuthProvider({
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

// Per-IP fixed-window limits, checked before the request reaches the OAuth
// provider or the Durable Object. /mcp gets a generous ceiling (legitimate
// MCP clients poll/call tools repeatedly); the OAuth-handshake routes get a
// tighter one since a real user only walks through them once per connect.
const MCP_LIMIT_PER_MINUTE = 120;
const AUTH_LIMIT_PER_MINUTE = 20;

interface RateLimitEnv {
  OAUTH_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: RateLimitEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const isMcp = url.pathname === "/mcp";
    const limited = await isRateLimited(
      env.OAUTH_KV,
      `${ip}:${isMcp ? "mcp" : "auth"}`,
      isMcp ? MCP_LIMIT_PER_MINUTE : AUTH_LIMIT_PER_MINUTE
    );
    if (limited) {
      return new Response("Too many requests. Try again in a minute.", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
    // provider.fetch's Env type includes OAUTH_PROVIDER, which the library
    // injects internally before dispatching to apiHandler/defaultHandler -
    // it's not a real wrangler.toml binding, so it can't appear on the Env
    // type this top-level fetch actually receives from the runtime.
    return provider.fetch(request, env as unknown as Parameters<typeof provider.fetch>[1], ctx);
  },
};
