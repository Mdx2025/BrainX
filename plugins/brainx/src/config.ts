export type BrainxBridgeMode = "off" | "auto" | "on";
export type BrainxBridgeLogLevel = "debug" | "info" | "warn" | "error";

export type BrainxBridgeConfig = {
  enabled: boolean;
  enforceAgentOptIn: boolean;
  enabledAgents: string[];
  wikiDigestEnabledAgents: string[];
  wikiDigest: boolean;
  wikiDigestMaxChars: number;
  wikiDigestPromptSignalsOnly: boolean;
  wikiDigestStaleHours: number;
  wikiDigestVaultDir: string;
  jitRecallEnabledAgents: string[];
  jitRecall: boolean;
  recallLimit: number;
  recallMinSimilarity: number;
  recallMinImportance: number;
  recallMaxChars: number;
  jitRecallAllowCrossAgent: boolean;
  jitRecallCrossAgentTagRequired: boolean;
  jitRecallCrossAgentRequireVerified: boolean;
  signalGateEnabled: boolean;
  signalGateMinImportance: number;
  signalGateMinSimilarity: number;
  signalGateStaleDays: number;
  signalGateRecencyDecayDays: number;
  antiDupPromptEnabled: boolean;
  antiDupPromptMinOverlap: number;
  // Minimum token-overlap ratio required between an injected working_memory
  // or wiki_digest block and the current prompt. 0 = inject always (historical
  // behavior). A low positive value (e.g. 0.05) filters blocks that share
  // effectively nothing with the prompt — the main ruido vector for
  // continuity surfaces that don't run through the jit_recall filter chain.
  workingMemoryMinRelevance: number;
  wikiDigestMinRelevance: number;
  workingMemoryEnabledAgents: string[];
  workingMemory: boolean;
  workingMemoryMaxChars: number;
  workingMemoryMaxEvents: number;
  workingMemoryUseLlm: boolean;
  workingMemoryLlmModel: string;
  workingMemoryLlmBaseURL: string;
  workingMemoryLlmCooldownMs: number;
  workingMemoryLlmMinTextChars: number;
  toolAdvisoriesEnabledAgents: string[];
  toolAdvisories: boolean;
  advisoryRequireApproval: boolean;
  advisoryApprovalThreshold: number;
  advisoryMaxChars: number;
  captureToolFailuresEnabledAgents: string[];
  captureToolFailures: boolean;
  writeFailuresToDailyMemory: boolean;
  writeFailuresToBrainx: boolean;
  bootstrapEnabledAgents: string[];
  bootstrapMode: BrainxBridgeMode;
  captureOutboundEnabledAgents: string[];
  captureOutboundMode: BrainxBridgeMode;
  logLevel: BrainxBridgeLogLevel;
};

const DEFAULTS: BrainxBridgeConfig = {
  enabled: true,
  enforceAgentOptIn: true,
  enabledAgents: [],
  wikiDigestEnabledAgents: [],
  wikiDigest: false,
  wikiDigestMaxChars: 700,
  wikiDigestPromptSignalsOnly: true,
  wikiDigestStaleHours: 72,
  wikiDigestVaultDir: "",
  jitRecallEnabledAgents: [],
  jitRecall: false,
  recallLimit: 4,
  // Lowered 2026-04-19 from 0.55 → 0.45. Empirical p90 of top_similarity in
  // brainx_query_log over the previous week was 0.52–0.61, so 0.55 silently
  // dropped >50% of queries (raw_count=0 across all agents). 0.45 aligns with
  // observed median; tune based on hit-rate telemetry in brainx_runtime_injections.
  recallMinSimilarity: 0.45,
  recallMinImportance: 6,
  recallMaxChars: 900,
  jitRecallAllowCrossAgent: false,
  jitRecallCrossAgentTagRequired: true,
  jitRecallCrossAgentRequireVerified: true,
  signalGateEnabled: true,
  signalGateMinImportance: 7,
  signalGateMinSimilarity: 0.72,
  signalGateStaleDays: 14,
  signalGateRecencyDecayDays: 30,
  antiDupPromptEnabled: true,
  antiDupPromptMinOverlap: 0.6,
  workingMemoryMinRelevance: 0.05,
  wikiDigestMinRelevance: 0.05,
  workingMemoryEnabledAgents: [],
  workingMemory: false,
  workingMemoryMaxChars: 800,
  workingMemoryMaxEvents: 12,
  workingMemoryUseLlm: false,
  workingMemoryLlmModel: "MiniMax-M2.7",
  workingMemoryLlmBaseURL: "https://api.minimax.io/v1",
  workingMemoryLlmCooldownMs: 75000,
  workingMemoryLlmMinTextChars: 180,
  toolAdvisoriesEnabledAgents: [],
  toolAdvisories: false,
  advisoryRequireApproval: false,
  advisoryApprovalThreshold: 0.88,
  advisoryMaxChars: 600,
  captureToolFailuresEnabledAgents: [],
  captureToolFailures: false,
  writeFailuresToDailyMemory: false,
  writeFailuresToBrainx: false,
  bootstrapEnabledAgents: [],
  bootstrapMode: "off",
  captureOutboundEnabledAgents: [],
  captureOutboundMode: "off",
  logLevel: "info",
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function asNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  let next = parsed;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function asMode(value: unknown, fallback: BrainxBridgeMode): BrainxBridgeMode {
  return value === "off" || value === "auto" || value === "on" ? value : fallback;
}

function asLogLevel(value: unknown, fallback: BrainxBridgeLogLevel): BrainxBridgeLogLevel {
  return value === "debug" || value === "info" || value === "warn" || value === "error" ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
          .filter(Boolean),
      ),
    );
  }
  if (typeof value === "string" && value.trim()) {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
  }
  return fallback;
}

export function resolveBrainxBridgeConfig(raw: unknown): BrainxBridgeConfig {
  const obj = asObject(raw);
  return {
    enabled: asBoolean(obj.enabled, DEFAULTS.enabled),
    enforceAgentOptIn: asBoolean(obj.enforceAgentOptIn, DEFAULTS.enforceAgentOptIn),
    enabledAgents: asStringArray(obj.enabledAgents, DEFAULTS.enabledAgents),
    wikiDigestEnabledAgents: asStringArray(obj.wikiDigestEnabledAgents, DEFAULTS.wikiDigestEnabledAgents),
    wikiDigest: asBoolean(obj.wikiDigest, DEFAULTS.wikiDigest),
    wikiDigestMaxChars: Math.round(asNumber(obj.wikiDigestMaxChars, DEFAULTS.wikiDigestMaxChars, 180, 2000)),
    wikiDigestPromptSignalsOnly: asBoolean(obj.wikiDigestPromptSignalsOnly, DEFAULTS.wikiDigestPromptSignalsOnly),
    wikiDigestStaleHours: Math.round(asNumber(obj.wikiDigestStaleHours, DEFAULTS.wikiDigestStaleHours, 1, 720)),
    wikiDigestVaultDir:
      typeof obj.wikiDigestVaultDir === "string" && obj.wikiDigestVaultDir.trim()
        ? obj.wikiDigestVaultDir.trim()
        : DEFAULTS.wikiDigestVaultDir,
    jitRecallEnabledAgents: asStringArray(obj.jitRecallEnabledAgents, DEFAULTS.jitRecallEnabledAgents),
    jitRecall: asBoolean(obj.jitRecall, DEFAULTS.jitRecall),
    recallLimit: Math.round(asNumber(obj.recallLimit, DEFAULTS.recallLimit, 1, 8)),
    recallMinSimilarity: asNumber(obj.recallMinSimilarity, DEFAULTS.recallMinSimilarity, 0, 1),
    recallMinImportance: Math.round(asNumber(obj.recallMinImportance, DEFAULTS.recallMinImportance, 0, 10)),
    recallMaxChars: Math.round(asNumber(obj.recallMaxChars, DEFAULTS.recallMaxChars, 200, 2000)),
    jitRecallAllowCrossAgent: asBoolean(obj.jitRecallAllowCrossAgent, DEFAULTS.jitRecallAllowCrossAgent),
    jitRecallCrossAgentTagRequired: asBoolean(obj.jitRecallCrossAgentTagRequired, DEFAULTS.jitRecallCrossAgentTagRequired),
    jitRecallCrossAgentRequireVerified: asBoolean(obj.jitRecallCrossAgentRequireVerified, DEFAULTS.jitRecallCrossAgentRequireVerified),
    signalGateEnabled: asBoolean(obj.signalGateEnabled, DEFAULTS.signalGateEnabled),
    signalGateMinImportance: Math.round(asNumber(obj.signalGateMinImportance, DEFAULTS.signalGateMinImportance, 0, 10)),
    signalGateMinSimilarity: asNumber(obj.signalGateMinSimilarity, DEFAULTS.signalGateMinSimilarity, 0, 1),
    signalGateStaleDays: Math.round(asNumber(obj.signalGateStaleDays, DEFAULTS.signalGateStaleDays, 1, 365)),
    signalGateRecencyDecayDays: Math.round(asNumber(obj.signalGateRecencyDecayDays, DEFAULTS.signalGateRecencyDecayDays, 1, 365)),
    antiDupPromptEnabled: asBoolean(obj.antiDupPromptEnabled, DEFAULTS.antiDupPromptEnabled),
    antiDupPromptMinOverlap: asNumber(obj.antiDupPromptMinOverlap, DEFAULTS.antiDupPromptMinOverlap, 0, 1),
    workingMemoryMinRelevance: asNumber(obj.workingMemoryMinRelevance, DEFAULTS.workingMemoryMinRelevance, 0, 1),
    wikiDigestMinRelevance: asNumber(obj.wikiDigestMinRelevance, DEFAULTS.wikiDigestMinRelevance, 0, 1),
    workingMemoryEnabledAgents: asStringArray(obj.workingMemoryEnabledAgents, DEFAULTS.workingMemoryEnabledAgents),
    workingMemory: asBoolean(obj.workingMemory, DEFAULTS.workingMemory),
    workingMemoryMaxChars: Math.round(asNumber(obj.workingMemoryMaxChars, DEFAULTS.workingMemoryMaxChars, 240, 2000)),
    workingMemoryMaxEvents: Math.round(asNumber(obj.workingMemoryMaxEvents, DEFAULTS.workingMemoryMaxEvents, 6, 20)),
    workingMemoryUseLlm: asBoolean(obj.workingMemoryUseLlm, DEFAULTS.workingMemoryUseLlm),
    workingMemoryLlmModel:
      typeof obj.workingMemoryLlmModel === "string" && obj.workingMemoryLlmModel.trim()
        ? obj.workingMemoryLlmModel.trim()
        : DEFAULTS.workingMemoryLlmModel,
    workingMemoryLlmBaseURL:
      typeof obj.workingMemoryLlmBaseURL === "string" && obj.workingMemoryLlmBaseURL.trim()
        ? obj.workingMemoryLlmBaseURL.trim()
        : DEFAULTS.workingMemoryLlmBaseURL,
    workingMemoryLlmCooldownMs: Math.round(asNumber(obj.workingMemoryLlmCooldownMs, DEFAULTS.workingMemoryLlmCooldownMs, 10000, 600000)),
    workingMemoryLlmMinTextChars: Math.round(asNumber(obj.workingMemoryLlmMinTextChars, DEFAULTS.workingMemoryLlmMinTextChars, 80, 2000)),
    toolAdvisoriesEnabledAgents: asStringArray(obj.toolAdvisoriesEnabledAgents, DEFAULTS.toolAdvisoriesEnabledAgents),
    toolAdvisories: asBoolean(obj.toolAdvisories, DEFAULTS.toolAdvisories),
    advisoryRequireApproval: asBoolean(obj.advisoryRequireApproval, DEFAULTS.advisoryRequireApproval),
    advisoryApprovalThreshold: asNumber(obj.advisoryApprovalThreshold, DEFAULTS.advisoryApprovalThreshold, 0, 1),
    advisoryMaxChars: Math.round(asNumber(obj.advisoryMaxChars, DEFAULTS.advisoryMaxChars, 120, 2000)),
    captureToolFailuresEnabledAgents: asStringArray(obj.captureToolFailuresEnabledAgents, DEFAULTS.captureToolFailuresEnabledAgents),
    captureToolFailures: asBoolean(obj.captureToolFailures, DEFAULTS.captureToolFailures),
    writeFailuresToDailyMemory: asBoolean(obj.writeFailuresToDailyMemory, DEFAULTS.writeFailuresToDailyMemory),
    writeFailuresToBrainx: asBoolean(obj.writeFailuresToBrainx, DEFAULTS.writeFailuresToBrainx),
    bootstrapEnabledAgents: asStringArray(obj.bootstrapEnabledAgents, DEFAULTS.bootstrapEnabledAgents),
    bootstrapMode: asMode(obj.bootstrapMode, DEFAULTS.bootstrapMode),
    captureOutboundEnabledAgents: asStringArray(obj.captureOutboundEnabledAgents, DEFAULTS.captureOutboundEnabledAgents),
    captureOutboundMode: asMode(obj.captureOutboundMode, DEFAULTS.captureOutboundMode),
    logLevel: asLogLevel(obj.logLevel, DEFAULTS.logLevel),
  };
}
