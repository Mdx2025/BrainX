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
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "brainx-signalgate-test-"));
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

function baseRow(overrides = {}) {
  return {
    type: "fact",
    tier: "hot",
    similarity: 0.85,
    importance: 8,
    agent: null,
    tags: [],
    verification_state: "verified",
    source_kind: "tool_verified",
    content: "brainx signal gate test memory with railway deploy context",
    context: "infrastructure",
    access_count: 5,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ...overrides,
  };
}

test("passesSignalGate: accepts high-importance recent verified row", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const ok = __testInternals.passesSignalGate(baseRow(), {
      minImportance: 7,
      minSimilarity: 0.72,
      staleDays: 14,
    });
    assert.equal(ok, true);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("passesSignalGate: rejects low importance", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const ok = __testInternals.passesSignalGate(baseRow({ importance: 5 }), {
      minImportance: 7,
      minSimilarity: 0.72,
      staleDays: 14,
    });
    assert.equal(ok, false);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("passesSignalGate: rejects low similarity", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const ok = __testInternals.passesSignalGate(baseRow({ similarity: 0.6 }), {
      minImportance: 7,
      minSimilarity: 0.72,
      staleDays: 14,
    });
    assert.equal(ok, false);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("passesSignalGate: rejects stale row (access_count=0, age>staleDays)", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const ok = __testInternals.passesSignalGate(
      baseRow({
        access_count: 0,
        created_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      }),
      { minImportance: 7, minSimilarity: 0.72, staleDays: 14 },
    );
    assert.equal(ok, false);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("passesSignalGate: accepts stale row if access_count > 0", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const ok = __testInternals.passesSignalGate(
      baseRow({
        access_count: 3,
        created_at: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      }),
      { minImportance: 7, minSimilarity: 0.72, staleDays: 14 },
    );
    assert.equal(ok, true);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("computeSignalScore: recent verified > old hypothesis with same importance", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const recent = __testInternals.computeSignalScore(
      baseRow({ importance: 8, verification_state: "verified", created_at: new Date().toISOString() }),
      30,
    );
    const old = __testInternals.computeSignalScore(
      baseRow({
        importance: 8,
        verification_state: "hypothesis",
        created_at: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      }),
      30,
    );
    assert.ok(recent > old, `recent=${recent} should be > old=${old}`);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("contentOverlapRatio: near-dup content returns high overlap", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { extractShingleTokens, contentOverlapRatio } = __testInternals;
    const prompt = "fix railway deploy pipeline timeout on staging environment";
    const promptShingles = extractShingleTokens(prompt);
    const memContent = "railway deploy pipeline timeout staging";
    const ratio = contentOverlapRatio(memContent, promptShingles);
    assert.ok(ratio > 0.6, `expected ratio > 0.6, got ${ratio}`);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("contentOverlapRatio: unrelated content returns low overlap", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const { extractShingleTokens, contentOverlapRatio } = __testInternals;
    const prompt = "fix railway deploy pipeline timeout on staging";
    const promptShingles = extractShingleTokens(prompt);
    const memContent = "database postgres schema migration tutorial";
    const ratio = contentOverlapRatio(memContent, promptShingles);
    assert.ok(ratio < 0.3, `expected ratio < 0.3, got ${ratio}`);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("config: signal gate defaults are strict", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { resolveBrainxBridgeConfig } = await loadModule(CONFIG_PATH);
    const cfg = resolveBrainxBridgeConfig({});
    assert.equal(cfg.signalGateEnabled, true);
    assert.equal(cfg.signalGateMinImportance, 7);
    assert.equal(cfg.signalGateMinSimilarity, 0.72);
    assert.equal(cfg.signalGateStaleDays, 14);
    assert.equal(cfg.antiDupPromptEnabled, true);
    assert.equal(cfg.antiDupPromptMinOverlap, 0.6);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("filterRecallRows: signal gate drops low-importance rows", async () => {
  const stateDir = await setupStateDir();
  process.env.OPENCLAW_STATE_DIR = stateDir;
  try {
    const { __testInternals } = await loadModule(BRIDGE_PATH);
    const rows = [
      baseRow({ content: "deploy railway high importance", importance: 9 }),
      baseRow({ content: "minor note low importance", importance: 4 }),
    ];
    const filtered = await __testInternals.filterRecallRows(rows, "coder", ["railway", "deploy", "note"], 0.5, {
      signalGate: { minImportance: 7, minSimilarity: 0.72, staleDays: 14 },
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].importance, 9);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});
