import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLUGIN_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BRIDGE_PATH = path.join(PLUGIN_ROOT, "src", "bridge.ts");
const CONFIG_PATH = path.join(PLUGIN_ROOT, "src", "config.ts");

async function setupStateDir() {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "brainx-recall-test-"));
  await fs.writeFile(
    path.join(stateDir, "openclaw.json"),
    JSON.stringify({ agents: { entries: [] } }, null, 2),
    "utf8",
  );
  return stateDir;
}

async function loadModule(modPath) {
  const seed = `${Date.now()}-${Math.random()}`;
  const url = `${pathToFileURL(modPath).href}?test=${seed}`;
  return await import(url);
}

// Helper to build a fake memory row
function row(overrides = {}) {
  return {
    type: "fact",
    tier: "hot",
    similarity: 0.7,
    agent: null,
    tags: [],
    verification_state: "verified",
    source_kind: "tool_verified",
    content: "test memory content with railway deploy",
    context: "infrastructure",
    last_accessed: new Date().toISOString(),
    ...overrides,
  };
}

test("isCrossAgentRowAllowed: NULL agent (global) is always allowed", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    // NULL agent + cross-agent disabled → still allowed (global memory)
    const result = isCrossAgentRowAllowed(row({ agent: null }), "coder", {
      allowCrossAgent: false,
      crossAgentTagRequired: true,
      crossAgentRequireVerified: true,
    });
    assert.equal(result, true, "NULL agent should be allowed (global memory)");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("isCrossAgentRowAllowed: same agent always allowed", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    const result = isCrossAgentRowAllowed(row({ agent: "coder" }), "coder", {
      allowCrossAgent: false,
      crossAgentTagRequired: true,
      crossAgentRequireVerified: true,
    });
    assert.equal(result, true, "same agent should always be allowed");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("isCrossAgentRowAllowed: same agent case-insensitive match", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    const result = isCrossAgentRowAllowed(row({ agent: "Coder" }), "coder", {
      allowCrossAgent: false,
      crossAgentTagRequired: true,
      crossAgentRequireVerified: true,
    });
    assert.equal(result, true, "case-insensitive same agent should be allowed");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("isCrossAgentRowAllowed: different agent with cross-agent OFF → REJECT", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    const result = isCrossAgentRowAllowed(
      row({ agent: "researcher", tags: ["cross-agent"], verification_state: "verified" }),
      "coder",
      { allowCrossAgent: false, crossAgentTagRequired: true, crossAgentRequireVerified: true },
    );
    assert.equal(result, false, "with cross-agent OFF, different agent must be rejected even if tagged");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("isCrossAgentRowAllowed: different agent with cross-agent ON, no tag → REJECT", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    const result = isCrossAgentRowAllowed(
      row({ agent: "researcher", tags: [], verification_state: "verified" }),
      "coder",
      { allowCrossAgent: true, crossAgentTagRequired: true, crossAgentRequireVerified: true },
    );
    assert.equal(result, false, "tag required but missing → reject");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("isCrossAgentRowAllowed: different agent with cross-agent ON + tag + verified → ALLOW", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    const result = isCrossAgentRowAllowed(
      row({ agent: "researcher", tags: ["cross-agent"], verification_state: "verified" }),
      "coder",
      { allowCrossAgent: true, crossAgentTagRequired: true, crossAgentRequireVerified: true },
    );
    assert.equal(result, true, "cross-agent allowed + tagged + verified → allow");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("isCrossAgentRowAllowed: different agent + tag but hypothesis verification → REJECT when verified required", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    const result = isCrossAgentRowAllowed(
      row({ agent: "researcher", tags: ["cross-agent"], verification_state: "hypothesis" }),
      "coder",
      { allowCrossAgent: true, crossAgentTagRequired: true, crossAgentRequireVerified: true },
    );
    assert.equal(result, false, "hypothesis verification → reject when verified required");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("isCrossAgentRowAllowed: relaxed mode (tag not required) allows untagged cross-agent memory", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { isCrossAgentRowAllowed } = __testInternals;

    const result = isCrossAgentRowAllowed(
      row({ agent: "researcher", tags: [], verification_state: "verified" }),
      "coder",
      { allowCrossAgent: true, crossAgentTagRequired: false, crossAgentRequireVerified: true },
    );
    assert.equal(result, true, "relaxed cross-agent (no tag required) → allow if verified");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("config: jitRecallAllowCrossAgent defaults to false (safe)", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { resolveBrainxBridgeConfig } = await loadModule(CONFIG_PATH);
    const cfg = resolveBrainxBridgeConfig({});
    assert.equal(cfg.jitRecallAllowCrossAgent, false, "default must be false to prevent cross-contamination");
    assert.equal(cfg.jitRecallCrossAgentTagRequired, true, "tag must be required by default");
    assert.equal(cfg.jitRecallCrossAgentRequireVerified, true, "verified must be required by default");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("config: explicit jitRecallAllowCrossAgent values are honored", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { resolveBrainxBridgeConfig } = await loadModule(CONFIG_PATH);
    const cfg = resolveBrainxBridgeConfig({
      jitRecallAllowCrossAgent: true,
      jitRecallCrossAgentTagRequired: false,
      jitRecallCrossAgentRequireVerified: false,
    });
    assert.equal(cfg.jitRecallAllowCrossAgent, true);
    assert.equal(cfg.jitRecallCrossAgentTagRequired, false);
    assert.equal(cfg.jitRecallCrossAgentRequireVerified, false);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("filterRecallRows: blocks cross-agent rows with default safe config", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { filterRecallRows } = __testInternals;

    const rows = [
      row({ agent: "coder", content: "deploy uses --no-cache flag" }),
      row({ agent: "researcher", tags: ["cross-agent"], content: "research notes about deploys" }),
      row({ agent: null, content: "global deploy fact about flags" }),
    ];

    // Default safe: cross-agent OFF
    const filtered = await filterRecallRows(rows, "coder", ["deploy"], 0.55, {
      allowCrossAgent: false,
      crossAgentTagRequired: true,
      crossAgentRequireVerified: true,
    });

    // Should keep coder's row + global, drop researcher's
    const agentsKept = filtered.map((r) => r.agent);
    assert.ok(agentsKept.includes("coder"), "coder's own memory must be kept");
    assert.ok(agentsKept.includes(null), "global (NULL agent) must be kept");
    assert.ok(!agentsKept.includes("researcher"), "researcher's memory must be filtered out");
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("shouldTriggerInjection: metadata lookup can trigger when the real prompt has a domain match", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const result = __testInternals.shouldTriggerInjection("Como se llama el repositorio del proyecto");
    assert.deepEqual(result, { fire: true, reason: "domain" });
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("shouldTriggerInjection: explicit recall still bypasses metadata lookup suppression", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const result = __testInternals.shouldTriggerInjection("Recuerda como se llama el repositorio del proyecto");
    assert.deepEqual(result, { fire: true, reason: "explicit" });
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("buildPromptQuery: live Discord wrapper uses only the actual message body", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const wrapped = `BrainX recall — usa solo lo que sea directamente relevante.
- GOTCHA [verified/tool_verified]: BUG OpenClaw Discord inbound worker timeout after visible progress

File delivery rule: If you create, export, convert, render, or otherwise produce a deliverable file.
Conversation info (untrusted metadata):
{"is_group_chat":true}

<<<EXTERNAL_UNTRUSTED_CONTENT id="abc">>>
Source: External
---
UNTRUSTED Discord message body
Pero a ver, creo que el problema es que el plugin inyecte cosas que no tengan que ver
<<<END_EXTERNAL_UNTRUSTED_CONTENT id="abc">>>`;

    const query = __testInternals.buildPromptQuery(wrapped);
    assert.equal(query, "Pero a ver, creo que el problema es que el plugin inyecte cosas que no tengan que ver");
    assert.ok(!query.includes("File delivery rule"));
    assert.ok(!query.includes("Discord inbound worker timeout"));
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("extractPromptTerms: live Discord wrapper excludes systemic delivery/media terms", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const wrapped = `File delivery rule: If you create, export, convert, render, or otherwise produce a deliverable file.
Conversation info (untrusted metadata):
{"is_group_chat":true}

<<<EXTERNAL_UNTRUSTED_CONTENT id="abc">>>
Source: External
---
UNTRUSTED Discord message body
como vas?
<<<END_EXTERNAL_UNTRUSTED_CONTENT id="abc">>>`;

    const terms = __testInternals.extractPromptTerms(wrapped);
    assert.deepEqual(terms, ["vas"]);
    assert.ok(!terms.includes("file"));
    assert.ok(!terms.includes("deliverable"));
    assert.ok(!terms.includes("discord"));
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("filterRecallRows: live wrapper does not match unrelated Discord timeout gotcha", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const wrapped = `BrainX recall — usa solo lo que sea directamente relevante.
- GOTCHA [verified/tool_verified]: BUG OpenClaw Discord inbound worker timeout after visible progress

File delivery rule: If you create, export, convert, render, or otherwise produce a deliverable file.
Conversation info (untrusted metadata):
{"is_group_chat":true}

<<<EXTERNAL_UNTRUSTED_CONTENT id="abc">>>
Source: External
---
UNTRUSTED Discord message body
Pero a ver, creo que el problema es que el plugin inyecte cosas que no tengan que ver
<<<END_EXTERNAL_UNTRUSTED_CONTENT id="abc">>>`;

    const row = {
      type: "gotcha",
      tier: "hot",
      similarity: 0.52,
      importance: 10,
      agent: null,
      tags: [],
      verification_state: "verified",
      source_kind: "tool_verified",
      access_count: 10,
      content: "BUG OpenClaw Discord inbound worker timeout after visible progress: Discord can show the generic inbound worker timed out message even when an agent already delivered visible progress/commentary during a long run.",
      context: "openclaw:bugs",
      created_at: new Date().toISOString(),
    };
    const terms = __testInternals.extractPromptTerms(wrapped);
    const filtered = await __testInternals.filterRecallRows([row], "operations", terms, 0.45, {
      signalGate: { minImportance: 6, minSimilarity: 0.45, staleDays: 45 },
    });
    assert.equal(filtered.length, 0);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});
