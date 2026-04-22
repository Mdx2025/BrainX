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
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "brainx-plugin-test-"));
  const workspaceDir = path.join(stateDir, "workspace-coder");
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(
    path.join(stateDir, "openclaw.json"),
    JSON.stringify(
      {
        agents: {
          entries: [{ id: "coder", workspace: workspaceDir }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  return { stateDir, workspaceDir };
}

async function loadBridgeModules(stateDir) {
  process.env.OPENCLAW_STATE_DIR = stateDir;
  const seed = `${Date.now()}-${Math.random()}`;
  const bridgeUrl = `${pathToFileURL(BRIDGE_PATH).href}?test=${seed}`;
  const configUrl = `${pathToFileURL(CONFIG_PATH).href}?test=${seed}`;
  const [{ BrainxBridge }, { resolveBrainxBridgeConfig }] = await Promise.all([
    import(bridgeUrl),
    import(configUrl),
  ]);
  return { BrainxBridge, resolveBrainxBridgeConfig };
}

function createBridgeConfig(resolveBrainxBridgeConfig) {
  return resolveBrainxBridgeConfig({
    enabled: true,
    enforceAgentOptIn: false,
    captureToolFailures: true,
    captureToolFailuresEnabledAgents: ["coder"],
    writeFailuresToDailyMemory: true,
    writeFailuresToBrainx: false,
    logLevel: "error",
  });
}

function createLogger() {
  return { debug() {}, info() {}, warn() {}, error() {} };
}

test("captures exec exitCode != 0 into daily memory and dedupes repeats", async () => {
  const { stateDir, workspaceDir } = await setupStateDir();
  try {
    const { BrainxBridge, resolveBrainxBridgeConfig } = await loadBridgeModules(stateDir);
    const bridge = new BrainxBridge({ logger: createLogger() }, createBridgeConfig(resolveBrainxBridgeConfig));
    const event = {
      toolName: "exec",
      params: { command: "false" },
      result: {
        details: {
          status: "completed",
          exitCode: 1,
          aggregated: "\n\n(Command exited with code 1)",
          cwd: workspaceDir,
        },
      },
    };
    const ctx = { agentId: "coder", sessionKey: "agent:coder:main" };

    await bridge.handleAfterToolCall(event, ctx);
    await bridge.handleAfterToolCall(event, ctx);

    const dailyPath = path.join(workspaceDir, "memory", `tool-failures-${new Date().toISOString().slice(0, 10)}.md`);
    const daily = await fs.readFile(dailyPath, "utf8");
    const entries = [...daily.matchAll(/\[brainx-tool-failure:[^\]]+\]/g)];
    const markers = await fs.readdir(path.join(stateDir, "brainx-plugin", "tool-failures"));

    assert.equal(entries.length, 1);
    assert.match(daily, /tool=exec/);
    assert.match(daily, /command=false/);
    assert.match(daily, /Command exited with code 1/);
    assert.equal(markers.length, 1);
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

test("does not capture successful exec results", async () => {
  const { stateDir, workspaceDir } = await setupStateDir();
  try {
    const { BrainxBridge, resolveBrainxBridgeConfig } = await loadBridgeModules(stateDir);
    const bridge = new BrainxBridge({ logger: createLogger() }, createBridgeConfig(resolveBrainxBridgeConfig));

    await bridge.handleAfterToolCall(
      {
        toolName: "exec",
        params: { command: "true" },
        result: {
          details: {
            status: "completed",
            exitCode: 0,
            aggregated: "ok",
            cwd: workspaceDir,
          },
        },
      },
      { agentId: "coder", sessionKey: "agent:coder:main" },
    );

    await assert.rejects(
      fs.access(path.join(workspaceDir, "memory", `tool-failures-${new Date().toISOString().slice(0, 10)}.md`)),
    );
    await assert.rejects(fs.access(path.join(stateDir, "brainx-plugin", "tool-failures")));
  } finally {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});
