import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { resolveBrainxBridgeConfig } from "./src/config.ts";
import { BrainxBridge } from "./src/bridge.ts";

const brainxPlugin = {
  id: "brainx",
  name: "BrainX OpenClaw Bridge",
  description:
    "Complementary BrainX plugin for compiled wiki digests, optional recall/advisories, conservative failure capture, and fallback bridge hooks",

  configSchema: {
    parse(value: unknown) {
      return resolveBrainxBridgeConfig(value);
    },
  },

  register(api: OpenClawPluginApi) {
    if (api.registrationMode !== "full") {
      return;
    }

    const cfg = resolveBrainxBridgeConfig(api.pluginConfig ?? {});
    if (!cfg.enabled) {
      return;
    }

    const bridge = new BrainxBridge(api, cfg);

    api.registerGatewayMethod("brainx.status", async ({ respond }) => {
      respond(true, {
        ok: true,
        plugin: "brainx",
        status: await bridge.getStatusSnapshot(),
      });
    });

    const promptHooksEnabled = cfg.wikiDigest || cfg.jitRecall || cfg.workingMemory;
    const toolHooksEnabled = cfg.workingMemory || cfg.toolAdvisories || cfg.captureToolFailures;
    const sessionHooksEnabled = cfg.workingMemory || cfg.jitRecall;
    const bridgeHooksEnabled = cfg.bootstrapMode !== "off" || cfg.captureOutboundMode !== "off";

    if (promptHooksEnabled) {
      api.on("before_prompt_build", async (event, ctx) => bridge.handleBeforePromptBuild(event, ctx));
    }
    if (sessionHooksEnabled) {
      api.on("llm_output", async (event, ctx) => bridge.handleLlmOutput(event, ctx));
      api.on("session_start", async (event, ctx) => bridge.handleSessionStart(event, ctx));
      api.on("session_end", async (event, ctx) => bridge.handleSessionEnd(event, ctx));
    }
    if (toolHooksEnabled) {
      api.on("before_tool_call", async (event, ctx) => bridge.handleBeforeToolCall(event, ctx));
      api.on("after_tool_call", async (event, ctx) => bridge.handleAfterToolCall(event, ctx));
    }
    if (cfg.bootstrapMode !== "off") {
      api.registerHook("agent:bootstrap", async (event) => bridge.handleAgentBootstrap(event), {
        name: "brainx-bootstrap-bridge",
        description: "Fallback BrainX bootstrap bridge when the internal auto-inject hook is disabled",
      });
    }
    if (cfg.captureOutboundMode !== "off") {
      api.registerHook("message:sent", async (event) => bridge.handleMessageSent(event), {
        name: "brainx-live-capture-bridge",
        description: "Fallback BrainX outbound capture bridge when the internal live-capture hook is disabled",
      });
    }

    if (promptHooksEnabled || toolHooksEnabled || bridgeHooksEnabled) {
      void bridge.logStartupSummary();
    }
  },
};

export default brainxPlugin;
