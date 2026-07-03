# Claude Desktop setup

Connect Claude Desktop to your WordPress site through the local Bridgistic MCP server.

## Prerequisites

- Node.js 20+ (`node --version`)
- The Bridgistic WordPress plugin installed and a key created (**Bridgistic → Claude Setup**)
- This repo cloned and built: `npm install && npm run build`

## 1. Locate your Claude Desktop config

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Create the file with `{}` if it doesn't exist yet.

## 2. Add the Bridgistic server

Merge this into the config (don't overwrite other servers you may have):

```json
{
  "mcpServers": {
    "bridgistic": {
      "command": "node",
      "args": [
        "/absolute/path/to/bridgistic-claude-marketplace/mcp-server/dist/index.js"
      ],
      "env": {
        "BRIDGISTIC_SITE_URL": "https://example.com",
        "BRIDGISTIC_KEY_ID": "your_key_id",
        "BRIDGISTIC_KEY_SECRET": "your_key_secret"
      }
    }
  }
}
```

Replace:

- the `args` path with the **absolute** path to `mcp-server/dist/index.js` in your clone (Windows: use double backslashes, e.g. `C:\\Users\\you\\bridgistic-claude-marketplace\\mcp-server\\dist\\index.js`);
- the three `env` values with your site URL and key credentials.

Shortcuts that do this for you:

- **Bridgistic → Claude Setup** generates this JSON with your real values (copy or download).
- **Bridgistic → Export Package** downloads a zip with the config plus `install-macos-linux.sh` / `install-windows.ps1`, which merge it into the right location with a backup.

## 3. Restart Claude Desktop

Fully quit (macOS: Cmd-Q; Windows: quit from the tray) and reopen. Bridgistic appears in the tools list (search icon → connectors/tools).

## 4. Verify

Ask Claude:

> Run bridgistic_get_site_info

You should see the site's WordPress/PHP versions, theme, and plugins. Check **WP Admin → Bridgistic → Logs** — the request is recorded there.

## Multiple sites

Point the server at a registry file instead of single-site env vars:

```json
"env": {
  "BRIDGISTIC_CONNECTIONS": "/absolute/path/to/connections.json"
}
```

`connections.json` (see `mcp-server/connections.example.json`):

```json
{
  "my-blog": { "siteUrl": "https://blog.example.com", "keyId": "wpk_…", "secret": "wps_…" },
  "my-shop": { "siteUrl": "https://shop.example.com", "keyId": "wpk_…", "secret": "wps_…" }
}
```

Claude then targets sites by alias (`site: "my-blog"`). Keep this file out of any repo and readable only by your user account.

## Safety tips

- Start with a **Read-only** key; widen scopes only when needed.
- Turn on **require approval** for keys that can write — destructive ops then wait in **Bridgistic → Approvals**.
- If a secret may have leaked, rotate the key (**Keys & Scopes → Rotate secret**); the key ID stays, the old secret dies instantly.

Problems? [TROUBLESHOOTING.md](../plugins/bridgistic/package/TROUBLESHOOTING.md) or **Bridgistic → Health Check**.
