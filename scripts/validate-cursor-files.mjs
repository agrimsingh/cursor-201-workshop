#!/usr/bin/env node
// Statically validates the Cursor configuration in this repo:
//   rules, skills, subagents, .cursor/mcp.json, plugin + marketplace manifests,
//   BUGBOT.md, plans, worktrees.json, and a secret scan of every tracked file.
//
// Usage: node scripts/validate-cursor-files.mjs [--step N]
//   --step N  also checks that the files expected at workshop step N exist (0 = main).
//             Defaults to the step implied by the current branch name, if any.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const failures = [];
const passes = [];
const ok = (message) => passes.push(message);
const fail = (message) => failures.push(message);
const rel = (file) => path.relative(root, file);
const read = (file) => readFileSync(file, "utf8");
const KEBAB = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

function list(dir, predicate = () => true) {
  const abs = path.join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .map((name) => path.join(abs, name))
    .filter(predicate);
}

function frontmatter(file) {
  const text = read(file);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { error: "missing YAML frontmatter (--- ... ---)" };
  try {
    return { data: parseYaml(match[1]) ?? {}, body: match[2] };
  } catch (error) {
    return { error: `frontmatter is not valid YAML: ${error.message}` };
  }
}

function requireString(data, key, file) {
  if (typeof data[key] !== "string" || !data[key].trim()) {
    fail(`${rel(file)}: frontmatter "${key}" must be a non-empty string`);
    return false;
  }
  return true;
}

// ---- rules -----------------------------------------------------------------
function validateRule(file) {
  const { data, body, error } = frontmatter(file);
  if (error) return fail(`${rel(file)}: ${error}`);
  let good = requireString(data, "description", file);
  if (data.alwaysApply !== undefined && typeof data.alwaysApply !== "boolean") {
    fail(`${rel(file)}: "alwaysApply" must be true or false`);
    good = false;
  }
  if (data.globs !== undefined && typeof data.globs !== "string" && !Array.isArray(data.globs)) {
    fail(`${rel(file)}: "globs" must be a string or a list`);
    good = false;
  }
  if (data.alwaysApply !== true && data.globs === undefined && !data.description) {
    fail(`${rel(file)}: a rule needs alwaysApply, globs or a description so Cursor knows when to use it`);
    good = false;
  }
  if (!body.trim()) {
    fail(`${rel(file)}: rule body is empty`);
    good = false;
  }
  if (good) ok(`rule ${rel(file)}`);
}

// ---- skills ----------------------------------------------------------------
function validateSkill(file) {
  const { data, body, error } = frontmatter(file);
  if (error) return fail(`${rel(file)}: ${error}`);
  const dirName = path.basename(path.dirname(file));
  let good = requireString(data, "name", file) && requireString(data, "description", file);
  if (good && !KEBAB.test(data.name)) {
    fail(`${rel(file)}: skill name "${data.name}" must be lowercase kebab-case`);
    good = false;
  }
  if (good && data.name !== dirName) {
    fail(`${rel(file)}: skill name "${data.name}" must match its folder "${dirName}"`);
    good = false;
  }
  if (!body.trim()) {
    fail(`${rel(file)}: skill body is empty`);
    good = false;
  }
  if (good) ok(`skill ${rel(file)}`);
}

// ---- subagents -------------------------------------------------------------
function validateAgent(file) {
  const { data, body, error } = frontmatter(file);
  if (error) return fail(`${rel(file)}: ${error}`);
  const base = path.basename(file).replace(/\.(md|mdc|markdown)$/, "");
  let good = requireString(data, "name", file) && requireString(data, "description", file);
  if (good && data.name !== base) {
    fail(`${rel(file)}: subagent name "${data.name}" must match the file name "${base}"`);
    good = false;
  }
  for (const key of ["readonly", "is_background"]) {
    if (data[key] !== undefined && typeof data[key] !== "boolean") {
      fail(`${rel(file)}: "${key}" must be true or false`);
      good = false;
    }
  }
  if (data.model !== undefined && typeof data.model !== "string") {
    fail(`${rel(file)}: "model" must be a string (for example "inherit")`);
    good = false;
  }
  if (!body.trim()) {
    fail(`${rel(file)}: subagent prompt is empty`);
    good = false;
  }
  if (good) ok(`subagent ${rel(file)}`);
}

// ---- commands (plugins) ----------------------------------------------------
function validateCommand(file) {
  const { data, body, error } = frontmatter(file);
  if (error) return fail(`${rel(file)}: ${error}`);
  const good = requireString(data, "name", file) && requireString(data, "description", file) && body.trim().length > 0;
  if (good) ok(`command ${rel(file)}`);
  else if (!body.trim()) fail(`${rel(file)}: command body is empty`);
}

// ---- secrets ---------------------------------------------------------------
const SECRET_PATTERNS = [
  [/gh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/github_pat_[A-Za-z0-9_]{40,}/, "GitHub fine-grained token"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "API secret key"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
];

function findSecrets(text) {
  return SECRET_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

// ---- mcp.json --------------------------------------------------------------
function validateMcp(file, { requireServer } = {}) {
  let config;
  try {
    config = JSON.parse(read(file));
  } catch (error) {
    return fail(`${rel(file)}: not valid JSON (${error.message})`);
  }
  const servers = config.mcpServers;
  if (!servers || typeof servers !== "object" || Object.keys(servers).length === 0) {
    return fail(`${rel(file)}: "mcpServers" must contain at least one server`);
  }
  let good = true;
  for (const [name, server] of Object.entries(servers)) {
    if (!server.command && !server.url) {
      fail(`${rel(file)}: server "${name}" needs a "command" or a "url"`);
      good = false;
    }
    for (const field of ["env", "headers"]) {
      for (const [key, value] of Object.entries(server[field] ?? {})) {
        const sensitive = /token|secret|key|auth|password|pat/i.test(key);
        if (sensitive && !/\$\{(env:)?[A-Za-z_][A-Za-z0-9_]*\}/.test(String(value))) {
          fail(`${rel(file)}: ${name}.${field}.${key} must reference an environment variable like \${env:NAME}, not a literal value`);
          good = false;
        }
      }
    }
  }
  const leaked = findSecrets(read(file));
  if (leaked.length) {
    fail(`${rel(file)}: looks like it contains a secret (${leaked.join(", ")})`);
    good = false;
  }
  if (requireServer && !servers[requireServer]) {
    fail(`${rel(file)}: expected an "${requireServer}" server`);
    good = false;
  }
  if (good) ok(`mcp ${rel(file)} (${Object.keys(servers).join(", ")}; no literal secrets)`);
}

// ---- plugins ---------------------------------------------------------------
function validatePlugin(dir) {
  const manifestPath = path.join(dir, ".cursor-plugin", "plugin.json");
  let manifest;
  try {
    manifest = JSON.parse(read(manifestPath));
  } catch (error) {
    return fail(`${rel(manifestPath)}: missing or invalid JSON (${error.message})`);
  }
  let good = true;
  if (typeof manifest.name !== "string" || !KEBAB.test(manifest.name)) {
    fail(`${rel(manifestPath)}: "name" must be lowercase kebab-case`);
    good = false;
  }
  if (manifest.version !== undefined && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    fail(`${rel(manifestPath)}: "version" must be semver`);
    good = false;
  }
  if (manifest.author !== undefined && typeof manifest.author?.name !== "string") {
    fail(`${rel(manifestPath)}: "author.name" is required when author is set`);
    good = false;
  }
  for (const key of ["rules", "agents", "skills", "commands", "hooks", "mcpServers", "logo"]) {
    const value = manifest[key];
    for (const entry of typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((v) => typeof v === "string") : []) {
      if (/^https?:/.test(entry)) continue;
      if (path.isAbsolute(entry) || entry.includes("..") || !existsSync(path.join(dir, entry))) {
        fail(`${rel(manifestPath)}: "${key}" path "${entry}" must be relative and exist`);
        good = false;
      }
    }
  }
  const skills = list(path.join(rel(dir), "skills"), (p) => statSync(p).isDirectory());
  const commands = list(path.join(rel(dir), "commands"), (p) => /\.(md|mdc|markdown|txt)$/.test(p));
  if (skills.length + commands.length === 0) {
    fail(`${rel(dir)}: plugin has no skills or commands`);
    good = false;
  }
  for (const skillDir of skills) validateSkill(path.join(skillDir, "SKILL.md"));
  for (const command of commands) validateCommand(command);
  for (const rule of list(path.join(rel(dir), "rules"), (p) => /\.mdc?$/.test(p))) validateRule(rule);
  for (const agent of list(path.join(rel(dir), "agents"), (p) => p.endsWith(".md"))) validateAgent(agent);
  if (!existsSync(path.join(dir, "README.md"))) {
    fail(`${rel(dir)}: plugins should ship a README.md`);
    good = false;
  }
  if (good) ok(`plugin ${rel(dir)} (${manifest.name}@${manifest.version ?? "unversioned"})`);
  return manifest.name;
}

function validateMarketplace(file) {
  let manifest;
  try {
    manifest = JSON.parse(read(file));
  } catch (error) {
    return fail(`${rel(file)}: invalid JSON (${error.message})`);
  }
  let good = typeof manifest.name === "string" && KEBAB.test(manifest.name) && typeof manifest.owner?.name === "string";
  if (!good) fail(`${rel(file)}: needs a kebab-case "name" and "owner.name"`);
  const names = new Set();
  for (const plugin of manifest.plugins ?? []) {
    const source = typeof plugin.source === "string" ? plugin.source : plugin.source?.path;
    const pluginManifest = source && path.join(root, source, ".cursor-plugin", "plugin.json");
    if (!plugin.name || names.has(plugin.name)) {
      fail(`${rel(file)}: plugin names must be present and unique`);
      good = false;
    }
    names.add(plugin.name);
    if (!pluginManifest || !existsSync(pluginManifest)) {
      fail(`${rel(file)}: plugin "${plugin.name}" source "${source}" has no .cursor-plugin/plugin.json`);
      good = false;
    } else if (JSON.parse(read(pluginManifest)).name !== plugin.name) {
      fail(`${rel(file)}: plugin "${plugin.name}" does not match the name in ${rel(pluginManifest)}`);
      good = false;
    }
  }
  if (!manifest.plugins?.length) {
    fail(`${rel(file)}: "plugins" must list at least one plugin`);
    good = false;
  }
  if (good) ok(`marketplace ${rel(file)} (${[...names].join(", ")})`);
}

// ---- other files -----------------------------------------------------------
function validateBugbot(file) {
  const text = read(file);
  const size = Buffer.byteLength(text);
  if (!text.trim()) return fail(`${rel(file)}: is empty`);
  if (size > 64 * 1024) return fail(`${rel(file)}: is ${size} bytes; keep it well under 64 KB`);
  if (!/^#{1,3} /m.test(text)) return fail(`${rel(file)}: add at least one markdown heading so reviewers can scan it`);
  ok(`bugbot ${rel(file)} (${size} bytes)`);
}

function validatePlan(file) {
  const { data, body, error } = frontmatter(file);
  if (error) return fail(`${rel(file)}: ${error}`);
  if (!data.name || !body.trim()) return fail(`${rel(file)}: plan needs a "name" and a body`);
  ok(`plan ${rel(file)}`);
}

function validateWorktrees(file) {
  try {
    const config = JSON.parse(read(file));
    const allowed = ["setup-worktree", "setup-worktree-unix", "setup-worktree-windows"];
    const unknown = Object.keys(config).filter((key) => !allowed.includes(key));
    if (unknown.length) return fail(`${rel(file)}: unknown keys ${unknown.join(", ")}`);
    ok(`worktrees ${rel(file)}`);
  } catch (error) {
    fail(`${rel(file)}: invalid JSON (${error.message})`);
  }
}

function scanTrackedFiles() {
  let files = [];
  try {
    files = execSync("git ls-files -co --exclude-standard", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return;
  }
  const offenders = [];
  for (const file of files) {
    if (/(^|\/)(node_modules|lib\/generated)\//.test(file) || /\.(png|jpg|jpeg|gif|ico|db|zip)$/.test(file)) continue;
    const abs = path.join(root, file);
    if (!existsSync(abs) || statSync(abs).size > 1024 * 1024) continue;
    if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".example")) offenders.push(`${file} (env file)`);
    const leaked = findSecrets(read(abs));
    if (leaked.length) offenders.push(`${file} (${leaked.join(", ")})`);
  }
  if (offenders.length) fail(`possible secrets committed: ${offenders.join("; ")}`);
  else ok(`secret scan of ${files.length} files`);
}

// ---- expectations per workshop step ------------------------------------------
function currentStep() {
  const flag = process.argv.indexOf("--step");
  if (flag !== -1) return Number(process.argv[flag + 1]);
  let branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
  if (!branch) {
    try {
      branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: root, encoding: "utf8" }).trim();
    } catch {
      branch = "";
    }
  }
  if (branch === "main") return 0;
  const match = /^step-(\d)-/.exec(branch);
  return match ? Number(match[1]) : null;
}

function expectFiles(step) {
  const expectations = [
    [0, "docs/architecture.md"],
    [0, ".cursor/plans/resolve-dispute.md"],
    [0, "plugins/bug-fix/.cursor-plugin/plugin.json"],
    [0, ".cursor-plugin/marketplace.json"],
    [2, ".cursor/rules/api-conventions.mdc"],
    [2, ".cursor/skills/create-api/SKILL.md"],
    [3, ".cursor/mcp.json"],
    [4, "docs/model-selection.md"],
    [5, ".cursor/agents/reviewer.md"],
    [5, ".cursor/agents/verifier.md"],
    [6, ".cursor/BUGBOT.md"],
  ];
  for (const [from, file] of expectations) {
    const present = existsSync(path.join(root, file));
    if (step >= from && !present) fail(`step ${step}: expected ${file}`);
    if (step >= from && present) ok(`step ${step}: has ${file}`);
  }
  if (step < 2 && list(".cursor/rules", (p) => /\.mdc?$/.test(p)).length > 0) {
    fail(`step ${step}: .cursor/rules should be empty until step 2`);
  }
  if (step < 2 && list(".cursor/skills").length > 0) fail(`step ${step}: .cursor/skills should be empty until step 2`);
}

// ---- run -------------------------------------------------------------------
for (const file of list(".cursor/rules", (p) => /\.mdc$/.test(p))) validateRule(file);
for (const dir of list(".cursor/skills", (p) => statSync(p).isDirectory())) validateSkill(path.join(dir, "SKILL.md"));
for (const file of list(".cursor/agents", (p) => /\.(md|mdc|markdown)$/.test(p))) validateAgent(file);
for (const file of list(".cursor/plans", (p) => p.endsWith(".md"))) validatePlan(file);
const step = currentStep();
if (existsSync(path.join(root, ".cursor/mcp.json"))) {
  validateMcp(path.join(root, ".cursor/mcp.json"), { requireServer: step !== null && step >= 3 ? "github" : undefined });
}
if (existsSync(path.join(root, ".cursor/worktrees.json"))) validateWorktrees(path.join(root, ".cursor/worktrees.json"));
if (existsSync(path.join(root, ".cursor/BUGBOT.md"))) validateBugbot(path.join(root, ".cursor/BUGBOT.md"));
for (const dir of list("plugins", (p) => statSync(p).isDirectory())) validatePlugin(dir);
if (existsSync(path.join(root, ".cursor-plugin/marketplace.json"))) validateMarketplace(path.join(root, ".cursor-plugin/marketplace.json"));
scanTrackedFiles();
if (step !== null && !Number.isNaN(step)) expectFiles(step);

for (const message of passes) console.log(`  ✓ ${message}`);
for (const message of failures) console.log(`  ✗ ${message}`);
console.log(
  `\nCursor files: ${passes.length} passed, ${failures.length} failed${step === null ? "" : ` (checked as step ${step})`}`,
);
process.exit(failures.length ? 1 : 0);
