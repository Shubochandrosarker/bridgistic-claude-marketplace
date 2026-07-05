import { generateCodeVerifier, deriveCodeChallenge } from "./pkce.js";
import { buildWpAuthorizeUrl, exchangeWpCode } from "./wp-oauth-client.js";
import { upsertTenant } from "./tenants-db.js";
import type { Env } from "./agent.js";

/**
 * Handles everything that isn't the `/mcp` API route or a path
 * @cloudflare/workers-oauth-provider serves itself (token/registration/
 * metadata endpoints). Two routes, forming the "Worker as OAuth client to
 * WordPress" half of the handshake - the "Worker as OAuth server to the AI
 * client" half is entirely the OAuthProvider library's job.
 *
 * FLOW_TTL / WP_STATE_TTL: both short-lived, single-use-in-practice KV
 * entries reusing the OAUTH_KV binding the library already requires, so no
 * second KV namespace is needed.
 */

const FLOW_TTL = 600;

interface ParsedAuthRequest {
  redirectUri: string;
  state: string;
  [key: string]: unknown;
}

interface StoredFlow {
  authRequest: ParsedAuthRequest;
}

interface StoredWpState {
  flowId: string;
  siteUrl: string;
  codeVerifier: string;
}

interface OAuthEnv extends Env {
  OAUTH_KV: KVNamespace;
  // Injected by @cloudflare/workers-oauth-provider before calling this handler.
  OAUTH_PROVIDER: {
    parseAuthRequest(request: Request): Promise<ParsedAuthRequest>;
    completeAuthorization(options: {
      request: unknown;
      userId: string;
      metadata: unknown;
      scope: string[];
      props: unknown;
    }): Promise<{ redirectTo: string }>;
  };
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function siteUrlForm(flowId: string, error?: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect your WordPress site</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f3f4f6;color:#1f2430;margin:0;padding:48px 20px;}
  .card{max-width:440px;margin:0 auto;background:#fff;border:1px solid #e2e4e9;border-radius:14px;padding:32px;box-shadow:0 8px 30px rgba(20,20,40,.08);}
  h1{font-size:1.25rem;margin:0 0 8px;} p{color:#565d6d;margin:0 0 20px;font-size:.92rem;}
  input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #d7dae0;border-radius:9px;font-size:.95rem;margin-bottom:14px;}
  button{width:100%;padding:11px;border:none;border-radius:9px;background:#2f6690;color:#fff;font-weight:600;font-size:.95rem;cursor:pointer;}
  .err{color:#9a2f24;background:#fbeae8;border:1px solid #f0c9c4;border-radius:9px;padding:10px 12px;font-size:.85rem;margin-bottom:14px;}
</style></head>
<body><div class="card">
  <h1>Connect your WordPress site</h1>
  <p>Enter the address of the site running the Bridgistic plugin. You'll approve the connection there, in your own WordPress admin.</p>
  ${error ? `<div class="err">${error}</div>` : ""}
  <form method="post" action="/authorize">
    <input type="hidden" name="flow_id" value="${flowId}" />
    <input type="url" name="site_url" placeholder="https://example.com" required autofocus />
    <button type="submit">Continue</button>
  </form>
</div></body></html>`;
}

function cleanSiteUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: OAuthEnv, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/authorize" && request.method === "GET") {
      const authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      const flowId = crypto.randomUUID();
      const flow: StoredFlow = { authRequest };
      await env.OAUTH_KV.put(`flow:${flowId}`, JSON.stringify(flow), { expirationTtl: FLOW_TTL });
      return html(siteUrlForm(flowId));
    }

    if (url.pathname === "/authorize" && request.method === "POST") {
      const form = await request.formData();
      const flowId = String(form.get("flow_id") || "");
      const rawSiteUrl = String(form.get("site_url") || "");

      const flowRaw = await env.OAUTH_KV.get(`flow:${flowId}`);
      if (!flowRaw) {
        return html("This connection request expired. Go back to your AI assistant and try connecting again.", 400);
      }

      const siteUrl = cleanSiteUrl(rawSiteUrl);
      if (!siteUrl) {
        return html(siteUrlForm(flowId, "Enter a valid https:// site address."), 400);
      }

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await deriveCodeChallenge(codeVerifier);
      const wpState = crypto.randomUUID();

      const stored: StoredWpState = { flowId, siteUrl, codeVerifier };
      await env.OAUTH_KV.put(`wpstate:${wpState}`, JSON.stringify(stored), { expirationTtl: FLOW_TTL });

      const redirectUri = `${url.origin}/wp-callback`;
      return Response.redirect(buildWpAuthorizeUrl(siteUrl, redirectUri, codeChallenge, wpState), 302);
    }

    if (url.pathname === "/wp-callback" && request.method === "GET") {
      const wpState = url.searchParams.get("state") || "";
      const storedRaw = await env.OAUTH_KV.get(`wpstate:${wpState}`);
      if (!storedRaw) {
        return html("This connection attempt expired or was already used. Go back to your AI assistant and try again.", 400);
      }
      await env.OAUTH_KV.delete(`wpstate:${wpState}`);
      const stored = JSON.parse(storedRaw) as StoredWpState;

      const flowRaw = await env.OAUTH_KV.get(`flow:${stored.flowId}`);
      if (!flowRaw) {
        return html("This connection request expired. Go back to your AI assistant and try connecting again.", 400);
      }
      const { authRequest } = JSON.parse(flowRaw) as StoredFlow;

      if (url.searchParams.get("error")) {
        // The admin clicked Deny in WordPress - bounce a standard OAuth
        // access_denied back through the AI client's own redirect_uri so it
        // can show its usual "connection cancelled" state instead of us
        // stranding the user on a Worker-hosted page.
        await env.OAUTH_KV.delete(`flow:${stored.flowId}`);
        const denyUrl = new URL(authRequest.redirectUri);
        denyUrl.searchParams.set("error", "access_denied");
        denyUrl.searchParams.set("state", authRequest.state);
        return Response.redirect(denyUrl.toString(), 302);
      }

      const code = url.searchParams.get("code") || "";
      if (!code) {
        return html("WordPress did not return an authorization code.", 400);
      }

      let tokenResult;
      try {
        const redirectUri = `${url.origin}/wp-callback`;
        tokenResult = await exchangeWpCode(stored.siteUrl, code, redirectUri, stored.codeVerifier);
      } catch (err) {
        return html(`Could not complete the connection: ${err instanceof Error ? err.message : String(err)}`, 502);
      }

      const tenantId = await upsertTenant(
        env.DB,
        env.TENANT_ENC_KEY,
        tokenResult.site_url,
        tokenResult.key_id,
        tokenResult.key_secret,
        tokenResult.scopes
      );

      await env.OAUTH_KV.delete(`flow:${stored.flowId}`);

      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: authRequest,
        userId: tenantId,
        scope: tokenResult.scopes,
        metadata: { siteUrl: tokenResult.site_url },
        props: { tenantId },
      });

      return Response.redirect(redirectTo, 302);
    }

    return new Response("Not found.", { status: 404 });
  },
};
