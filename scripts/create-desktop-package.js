#!/usr/bin/env node
/**
 * Builds dist/bridgistic-desktop-package.zip — a Claude Desktop-oriented
 * package laid out to be migrated to the .mcpb desktop-extension format
 * later. It is a plain zip on purpose: we do not fake .mcpb compatibility
 * until the manifest is finalized and validated against the official spec
 * (tracked in docs/ROADMAP.md).
 *
 * Layout:
 *   manifest-draft.json   — draft metadata (NOT a valid mcpb manifest yet)
 *   server/index.js       — self-contained MCP server bundle
 *   claude_desktop_config.example.json
 *   install scripts + TROUBLESHOOTING.md
 */

import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ZipWriter } from "./lib/zip.js";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const DIST = join(ROOT, "dist");
mkdirSync(DIST, { recursive: true });

const bundle = join(ROOT, "plugins/bridgistic/server/index.js");
if (!existsSync(bundle)) {
  console.error("✗ server bundle missing — run `npm run build` first.");
  process.exit(1);
}

const pluginMeta = JSON.parse(
  readFileSync(join(ROOT, "plugins/bridgistic/.claude-plugin/plugin.json"), "utf8")
);

const zip = new ZipWriter();

zip.addString(
  "manifest-draft.json",
  JSON.stringify(
    {
      // DRAFT — not a valid .mcpb manifest. Field names will be aligned with
      // the official desktop-extension spec before we ship a real .mcpb.
      draft: true,
      name: pluginMeta.name,
      display_name: "Bridgistic",
      version: pluginMeta.version,
      description: pluginMeta.description,
      author: pluginMeta.author,
      license: pluginMeta.license,
      server: {
        type: "node",
        entry_point: "server/index.js",
        env_keys: ["BRIDGISTIC_SITE_URL", "BRIDGISTIC_KEY_ID", "BRIDGISTIC_KEY_SECRET"],
      },
    },
    null,
    2
  ) + "\n"
);

zip.addFile("server/index.js", bundle);
zip.addFile("server/package.json", join(ROOT, "plugins/bridgistic/server/package.json"));
zip.addFile(
  "claude_desktop_config.example.json",
  join(ROOT, "plugins/bridgistic/package/claude_desktop_config.example.json")
);
zip.addFile("install-windows.ps1", join(ROOT, "plugins/bridgistic/package/install-windows.ps1"));
zip.addFile("install-macos-linux.sh", join(ROOT, "plugins/bridgistic/package/install-macos-linux.sh"));
zip.addFile("TROUBLESHOOTING.md", join(ROOT, "plugins/bridgistic/package/TROUBLESHOOTING.md"));
zip.addString(
  "README.md",
  "# Bridgistic — Desktop package (mcpb-ready layout)\n\nThis is a plain zip today. Use install-windows.ps1 / install-macos-linux.sh\nto wire the bundled server into Claude Desktop, passing the absolute path\nto the extracted server/index.js.\n\nA true one-click .mcpb desktop extension is planned — see docs/ROADMAP.md.\n"
);

const out = zip.write(join(DIST, "bridgistic-desktop-package.zip"));
console.log(`✓ ${relative(ROOT, out)} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
