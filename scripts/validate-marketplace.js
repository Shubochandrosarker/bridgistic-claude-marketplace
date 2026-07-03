#!/usr/bin/env node
/**
 * Validates the marketplace repo before publishing:
 *   1. Required files exist (manifests, mcp config, package files, docs).
 *   2. All JSON manifests parse and carry the required fields.
 *   3. mcp.json points at a server file that exists.
 *   4. No obvious secrets are committed.
 *
 * Exits non-zero on any failure. Run via `npm run validate`.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

let failures = 0;
let warnings = 0;

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => {
  warnings++;
  console.log(`  ⚠ ${msg}`);
};
const fail = (msg) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
  } catch (err) {
    fail(`${path}: invalid JSON — ${err.message}`);
    return null;
  }
}

// ---- 1. Required files --------------------------------------------------------

console.log("\nRequired files");

const REQUIRED = [
  ".claude-plugin/marketplace.json",
  "plugins/bridgistic/.claude-plugin/plugin.json",
  "plugins/bridgistic/mcp.json",
  "plugins/bridgistic/README.md",
  "plugins/bridgistic/server/index.js",
  "plugins/bridgistic/package/claude_desktop_config.example.json",
  "plugins/bridgistic/package/claude_code_config.example.json",
  "plugins/bridgistic/package/connections.example.json",
  "plugins/bridgistic/package/install-windows.ps1",
  "plugins/bridgistic/package/install-macos-linux.sh",
  "plugins/bridgistic/package/TROUBLESHOOTING.md",
  "mcp-server/package.json",
  "mcp-server/.env.example",
  "wordpress-plugin/bridgistic/bridgistic.php",
  "docs/INSTALL.md",
  "docs/CLAUDE_DESKTOP.md",
  "docs/CLAUDE_CODE.md",
  "docs/WORDPRESS_SETUP.md",
  "docs/SECURITY.md",
  "docs/FREE_VS_PAID.md",
  "docs/ROADMAP.md",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
];

for (const file of REQUIRED) {
  if (existsSync(join(ROOT, file))) {
    ok(file);
  } else {
    fail(`missing: ${file}`);
  }
}

// ---- 2. Manifest contents -------------------------------------------------------

console.log("\nManifests");

const marketplace = readJson(".claude-plugin/marketplace.json");
if (marketplace) {
  if (!marketplace.name) fail("marketplace.json: missing name");
  if (!marketplace.owner?.name) fail("marketplace.json: missing owner.name");
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    fail("marketplace.json: plugins[] is empty");
  } else {
    const entry = marketplace.plugins.find((p) => p.name === "bridgistic");
    if (!entry) {
      fail('marketplace.json: no plugin named "bridgistic"');
    } else {
      if (entry.source !== "./plugins/bridgistic") {
        fail(`marketplace.json: bridgistic source is ${entry.source}, expected ./plugins/bridgistic`);
      }
      const sourceDir = join(ROOT, "plugins/bridgistic");
      if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
        fail("marketplace.json: plugin source directory missing");
      }
      ok(`marketplace.json valid (plugin "bridgistic" v${entry.version ?? "?"})`);
    }
  }
}

const plugin = readJson("plugins/bridgistic/.claude-plugin/plugin.json");
if (plugin) {
  if (plugin.name !== "bridgistic") fail(`plugin.json: name is "${plugin.name}", expected "bridgistic"`);
  if (!plugin.version) fail("plugin.json: missing version");
  if (!plugin.description) fail("plugin.json: missing description");
  if (plugin.name === "bridgistic" && plugin.version && plugin.description) ok("plugin.json valid");
  if (marketplace) {
    const entry = marketplace.plugins?.find((p) => p.name === "bridgistic");
    if (entry && entry.version !== plugin.version) {
      warn(`version mismatch: marketplace.json ${entry.version} vs plugin.json ${plugin.version}`);
    }
  }
}

const mcp = readJson("plugins/bridgistic/mcp.json");
if (mcp) {
  const server = mcp.mcpServers?.bridgistic;
  if (!server) {
    fail("mcp.json: missing mcpServers.bridgistic");
  } else {
    if (server.command !== "node") warn(`mcp.json: command is "${server.command}" (expected node)`);
    const arg = server.args?.[0] ?? "";
    if (!arg.includes("${CLAUDE_PLUGIN_ROOT}")) {
      warn("mcp.json: server path does not use ${CLAUDE_PLUGIN_ROOT} — relative paths are unreliable after install");
    }
    const resolved = arg.replace("${CLAUDE_PLUGIN_ROOT}", join(ROOT, "plugins/bridgistic"));
    if (!existsSync(resolved)) {
      fail(`mcp.json: server file not found at ${relative(ROOT, resolved)} — run npm run build`);
    } else {
      ok("mcp.json valid, bundled server present");
    }
  }
}

for (const example of [
  "plugins/bridgistic/package/claude_desktop_config.example.json",
  "plugins/bridgistic/package/claude_code_config.example.json",
  "plugins/bridgistic/package/connections.example.json",
]) {
  if (existsSync(join(ROOT, example)) && readJson(example)) ok(`${example} parses`);
}

// ---- 3. Secret scan ----------------------------------------------------------------

console.log("\nSecret scan");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "languages"]);
const SKIP_FILES = new Set(["package-lock.json"]);
const TEXT_EXT = /\.(js|ts|mjs|cjs|json|php|md|txt|sh|ps1|yml|yaml|css|html|env|example)$/i;

// Real Bridgistic credentials are hex; placeholders use x/y padding.
const PATTERNS = [
  { re: /wps_[0-9a-f]{48}/g, label: "Bridgistic key secret" },
  { re: /wpk_[0-9a-f]{24}/g, label: "Bridgistic key id" },
  { re: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g, label: "private key" },
  { re: /sk-ant-[a-zA-Z0-9-_]{20,}/g, label: "Anthropic API key" },
  { re: /ghp_[A-Za-z0-9]{36}/g, label: "GitHub token" },
  { re: /AKIA[0-9A-Z]{16}/g, label: "AWS access key" },
  { re: /xox[baprs]-[0-9A-Za-z-]{10,}/g, label: "Slack token" },
];

let scanned = 0;
const hits = [];

function scanDir(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(name)) scanDir(path);
      continue;
    }
    if (SKIP_FILES.has(name) || !TEXT_EXT.test(name) || stats.size > 5 * 1024 * 1024) continue;
    scanned++;
    const content = readFileSync(path, "utf8");
    for (const { re, label } of PATTERNS) {
      const found = content.match(re);
      if (found) {
        hits.push({ file: relative(ROOT, path), label, sample: found[0].slice(0, 12) + "…" });
      }
    }
  }
}

scanDir(ROOT);

if (hits.length) {
  for (const hit of hits) fail(`possible ${hit.label} in ${hit.file} (${hit.sample})`);
} else {
  ok(`no secrets found in ${scanned} scanned files`);
}

// ---- verdict ---------------------------------------------------------------------------

console.log("");
if (failures) {
  console.error(`FAILED — ${failures} problem(s), ${warnings} warning(s).`);
  process.exit(1);
}
console.log(`PASSED — 0 problems, ${warnings} warning(s).`);
