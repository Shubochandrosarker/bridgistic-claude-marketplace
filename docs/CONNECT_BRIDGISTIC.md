# Connecting Bridgistic — the complete guide

This is the single walkthrough to go from "I just installed the plugin" to "my AI assistant can
safely read and edit my WordPress site." It's written for site owners, not developers — if
something below doesn't match what you see, jump to [Troubleshooting](#troubleshooting) or run
**Bridgistic → Health Check** first.

**Read this if:** you want the shortest, least error-prone path to a working connection.
**Skip to a specific client's page** ([Claude Desktop](CLAUDE_DESKTOP.md),
[Claude Code](CLAUDE_CODE.md), [Codex CLI](CODEX_SETUP.md), [Gemini CLI](GEMINI_SETUP.md),
[ChatGPT](CHATGPT_SETUP.md)) only if you already know which one you're using and want copy-paste
config details.

---

## Before you start: what's actually available right now

Bridgistic has two ways to connect an AI assistant to your site. **Only one of them is available
to you today** — the guide below is entirely about that one.

| | Local connection (this guide) | Cloud connector |
|---|---|---|
| Status | **Live, fully supported** | Private beta — not accessible from this plugin yet |
| How it works | Your AI app runs a small server on your own computer that talks to your site | A hosted relay would broker the connection with no local install |
| Setup effort | One key to create, one app to configure | Would be one click, once released |
| Works with | Claude Desktop, Claude Code, Codex CLI, Gemini CLI | Would add ChatGPT and other remote-only clients |

If you came here looking for a one-click "connect to the cloud" button in the dashboard — it
doesn't exist yet on purpose (see [CLOUD_CONNECTOR.md](CLOUD_CONNECTOR.md) for why). Use the local
connection below; it takes about five minutes and is the fully supported path.

---

## The five-minute path (recommended for almost everyone)

This is **Claude Desktop + the one-click extension** — the fewest steps, no terminal, no Node.js
install.

### Step 1 — Install the WordPress plugin

1. Download `bridgistic-wordpress-plugin.zip` from the
   [Releases page](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/releases).
2. In WordPress: **Plugins → Add New → Upload Plugin**, choose the zip, click **Install Now**,
   then **Activate**.
3. A new **Bridgistic** menu appears in your left sidebar. That confirms it worked — nothing on
   your site's content or theme was touched.

Before continuing, make sure:
- Your site uses **HTTPS** (a plain `http://` address only works for local development sites).
- **Settings → Permalinks** is set to anything other than "Plain."

### Step 2 — Create a key

1. Go to **Bridgistic → Claude Setup**.
2. **Step 1 of the wizard:** choose **Claude Desktop Extension**.
3. **Step 2:** choose a permission preset. Start with **Read-only** — you can widen this later
   once you trust the connection; it cannot create, change, or delete anything on this preset.
4. **Step 3:** click **Create key**.
5. A **Key ID** (`wpk_…`) and a **Secret** (`wps_…`) appear. **Copy both somewhere safe right
   now** — the secret is shown exactly once. If you navigate away before copying it, the key still
   exists but you'll need to click **Rotate** to get a new secret.

### Step 3 — Install the extension in Claude Desktop

1. Download
   [`bridgistic.mcpb`](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/releases/latest/download/bridgistic.mcpb)
   (there's also a direct download button on the wizard's Step 4).
2. Double-click the downloaded file. Claude Desktop opens and asks to install the extension.
3. Claude Desktop then prompts for three values — paste in what you copied in Step 2:
   - **WordPress Site URL** — exactly as it appears in **WP Admin → Settings → General**
     (e.g. `https://example.com`, no trailing slash)
   - **Bridgistic Key ID**
   - **Bridgistic Key Secret**
4. Click **Enable**. The secret is stored securely by Claude Desktop itself — it is never written
   to a plain text file.

### Step 4 — Verify it's working

1. In Claude Desktop, start a new chat and ask:
   > Run bridgistic_get_site_info
2. Claude should reply with your WordPress version, PHP version, active theme, and plugin list.
3. Back in WordPress, open **Bridgistic → Logs** — you should see that request recorded. The
   **Bridgistic → Dashboard** connection badge also flips from "Waiting for first request" to
   "Connected."

That's it — done. If step 4 didn't work, go to [Troubleshooting](#troubleshooting).

---

## Using a different AI client

The plugin's setup wizard (**Bridgistic → Claude Setup**) generates ready-to-paste configuration
for each of these — pick your client on Step 1 of the wizard, then follow its guide for the
one-time setup around it (installing the CLI/app itself, where its config file lives, restarting
it):

| Client | Runs locally? | Guide |
|---|---|---|
| Claude Desktop (manual config, no extension) | Yes | [CLAUDE_DESKTOP.md](CLAUDE_DESKTOP.md) |
| Claude Code | Yes | [CLAUDE_CODE.md](CLAUDE_CODE.md) |
| OpenAI Codex CLI | Yes | [CODEX_SETUP.md](CODEX_SETUP.md) |
| Gemini CLI | Yes | [GEMINI_SETUP.md](GEMINI_SETUP.md) |
| ChatGPT | No — remote only | [CHATGPT_SETUP.md](CHATGPT_SETUP.md) (needs the cloud connector, currently private beta) |
| Anything else that speaks MCP | Depends | Use the wizard's "Manual MCP JSON" option |

All of the "runs locally" options follow the same shape as the extension path above, with one
extra manual step: you paste a JSON snippet into that client's own config file, and you need
Node.js 20+ installed (`node --version` to check) unless you're using the pre-built extension.
The wizard's Step 4 generates the exact JSON for you, and **Bridgistic → Export Package**
downloads it as a ready-made zip with install scripts.

**Important — what "Test connection" in the wizard actually checks:** Step 5's "Run test" button
only confirms your WordPress site and key are configured correctly on the server side. It does
**not** confirm your AI client is set up right — that's what Step 4 above (asking Claude to run a
tool) is for. Don't stop at a green "Run test" result and assume you're fully connected; always
do the "ask Claude to run bridgistic_get_site_info" check too.

**Managing more than one WordPress site?** See [CONNECT_OTHER_AI.md](CONNECT_OTHER_AI.md) for the
multi-site `connections.json` registry — one key per site, one shared config file.

---

## Understanding what you just gave access to

- **Scoped, not all-powerful.** The key you created only allows what its permission preset says
  (Read-only / Content Manager / Safe Admin / Developer Mode). Check **Bridgistic → Keys &
  Scopes** any time to see or change this.
- **Every request is logged.** **Bridgistic → Logs** shows exactly what was requested, when, and
  by which key.
- **Destructive actions can require your approval.** If your preset includes approvals, risky
  operations pause in **Bridgistic → Approvals** until you personally allow them.
- **Changes can be undone.** Before any destructive write, Bridgistic automatically snapshots the
  affected data — **Bridgistic → Snapshots** lets you restore with one click.
- **You can revoke access instantly.** **Bridgistic → Keys & Scopes → Revoke** disables a key
  immediately; nothing further can be done with it.

---

## Troubleshooting

Run **Bridgistic → Health Check** first — it runs 16 diagnostics and tells you exactly what's
wrong and how to fix it. The most common issues:

| Symptom | Likely cause | Fix |
|---|---|---|
| "Run test" fails in the wizard | REST API blocked, permalinks set to "Plain," or clock drift between server and your computer | Health Check names the exact failing check and its fix |
| Claude says the tool doesn't exist / times out | The extension/config wasn't restarted after setup, or the site URL has a typo | Fully quit and reopen your AI client; double-check the site URL has no trailing slash and matches Settings → General exactly |
| "Invalid signature" or "Unauthorized" errors | The secret was mistyped, or the key was rotated/revoked since you configured it | Recreate or rotate the key in **Keys & Scopes**, and re-paste the new secret into your AI client |
| Nothing appears in Logs after asking Claude to run a tool | Your AI client isn't actually using this key — check its own MCP server list/settings | Re-check the config was pasted into the right file and the client was restarted |
| A hosting firewall (WAF) is blocking requests | Some managed WordPress hosts block unfamiliar REST API traffic | Health Check's "REST API reachable" and "WAF interference" checks flag this with host-specific guidance |

Full diagnostic reference: `plugins/bridgistic/package/TROUBLESHOOTING.md`. Still stuck? Open a
[GitHub issue](https://github.com/Shubochandrosarker/bridgistic-claude-marketplace/issues) or copy
the no-secrets debug report from **Bridgistic → Health Check** into it.

---

## FAQ

**Do I need to know how to code?** No. The five-minute path above involves no terminal and no file
editing.

**Is my API key/password shared with Claude, WordPress.com, or Anthropic?** No. The key lives only
between your AI client (running on your own computer) and your own WordPress site. Bridgistic
never sends it anywhere else.

**What if I lose the secret?** You can't view it again, but nothing is broken — go to
**Keys & Scopes** and click **Rotate** to generate a fresh secret, then re-paste it into your AI
client.

**Can I use this on more than one site?** Yes, see [CONNECT_OTHER_AI.md](CONNECT_OTHER_AI.md).

**Why can't I just paste one cloud URL like some other tools?** That flow exists in the code
already but hasn't passed a security review or been publicly released yet — see
[CLOUD_CONNECTOR.md](CLOUD_CONNECTOR.md) if you're curious about its current state.
