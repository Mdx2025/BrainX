import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { BrainxBridgeConfig } from "./config.ts";

const STATE_DIR = process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
const BRAINX_DIR = path.join(STATE_DIR, "skills", "brainx");
const brainxRequire = createRequire(path.join(BRAINX_DIR, "package.json"));

const TOOL_FAILURE_SECTION = "## BrainX Plugin Tool Failures";
const TOOL_FAILURE_FILE_PREFIX = "tool-failures-";
const TOOL_FAILURE_CACHE_TTL_MS = 5 * 60 * 1000;
const RECALL_CACHE_TTL_MS = 90 * 1000;
const WIKI_DIGEST_CACHE_TTL_MS = 90 * 1000;
const SOURCE_FRESHNESS_CACHE_TTL_MS = 2 * 60 * 1000;
const STARTUP_LOG_SUPPRESS_KEY = Symbol.for("openclaw.plugins.suppress-startup-logs");
const STARTUP_LOG_SUPPRESS_PROCESS_KEY = Symbol.for("openclaw.plugins.suppress-startup-logs.process");
const STARTUP_LOG_ONCE_KEY = Symbol.for("openclaw.plugins.brainx.startup-summary-logged");
const STARTUP_LOG_ONCE_PROCESS_KEY = Symbol.for("openclaw.plugins.brainx.startup-summary-logged.process");

function shouldSuppressStartupLogs(): boolean {
  return (
    Number((globalThis as any)[STARTUP_LOG_SUPPRESS_KEY] ?? 0) > 0 ||
    Number((process as any)[STARTUP_LOG_SUPPRESS_PROCESS_KEY] ?? 0) > 0 ||
    process.env.OPENCLAW_SUPPRESS_STARTUP_LOGS === "1"
  );
}

function reserveStartupSummaryLog(): boolean {
  if (shouldSuppressStartupLogs()) return false;
  if ((globalThis as any)[STARTUP_LOG_ONCE_KEY] || (process as any)[STARTUP_LOG_ONCE_PROCESS_KEY]) {
    return false;
  }
  (globalThis as any)[STARTUP_LOG_ONCE_KEY] = true;
  (process as any)[STARTUP_LOG_ONCE_PROCESS_KEY] = true;
  return true;
}

const ALLOWED_RECALL_TYPES = new Set(["fact", "decision", "gotcha"]);
const PRIMARY_ALLOWED_SOURCE_KINDS = new Set([
  "knowledge_canonical",
  "tool_verified",
  "user_explicit",
]);
const SECONDARY_ALLOWED_SOURCE_KINDS = new Set(["agent_inference"]);
const HISTORICAL_ALLOWED_SOURCE_KINDS = new Set(["consolidated"]);
const SOURCE_FRESHNESS_KINDS = new Set([
  "knowledge_canonical",
  "knowledge_staging",
  "knowledge_generated",
  "tool_verified",
  "user_explicit",
]);
// BRAINX_CLAUDE_CLI_TOOLS_20260420: include Claude CLI tool names (Bash,
// MultiEdit, NotebookEdit, WebFetch, Task) so ACP agents' tool failures can
// be captured once after_tool_call emission is wired from dispatch-acp.
// Comparison is case-insensitive (see shouldCaptureFailure).
const HIGH_RISK_FALLBACK_TOOLS = new Set([
  "exec", "message", "write", "edit", "apply_patch", "browser",
  "bash", "multiedit", "notebookedit", "webfetch", "task",
]);
const TROUBLESHOOTING_PROMPT_RE = /\b(error|bug|issue|problem|falla|falla[nr]?|fallando|broken|breaks?|failing|failed|timeout|timed out|denied|permission|auth|unauthorized|forbidden|not found|invalid|doesn'?t work|doesnt work|no funciona|no sirve|rompi[oó]|stack trace|exception)\b/i;
const SOLUTION_SIGNAL_RE = /\b(use|using|set|switch|rebuild|remove|eliminate|retry|run|restart|connect|proxy|token|gateway|bridge|fix|avoid|must|debe|usar|configurar|cambiar|rehacer|quitar|eliminar|reintentar|ejecutar|reiniciar|conectar)\b/i;
const WIKI_DIGEST_SIGNAL_RE = /\b(memory|brainx|wiki|recall|history|historial|timeline|context|contexto|constraints?|guardrails?|decision|decisión|decisiones|what changed|qué cambió|que cambió|what do we know|qué sabemos|que sabemos|background|before|antes|known issue|known fix|risk|riesgo|gotcha|pitfall)\b/i;
const DIRECT_MATCH_STOP_WORDS = new Set([
  "a", "about", "actual", "again", "algo", "alguna", "alguno", "algun", "all", "and", "antes",
  "apply", "arquitectura", "as", "at", "ayuda", "because", "bug", "by", "can", "como", "con",
  "consulta", "current", "de", "del", "does", "donde", "el", "ella", "ellos", "en", "error", "es",
  "esta", "este", "esto", "for", "from", "gateway", "hay", "how", "http", "https", "i", "if", "in",
  "is", "it", "jit", "la", "las", "latest", "lo", "los", "me", "mi", "my", "necesito", "no", "not",
  "of", "on", "or", "para", "por", "pregunta", "problem", "prompt", "que", "qué", "recall", "related",
  "relevant", "really", "resolved", "se", "si", "sí", "sin", "sobre", "solved", "the", "this", "to",
  "true", "un", "una", "use", "user", "vigente", "what", "why", "with", "y", "ya",
]);

let cachedOpenClawConfig: { mtimeMs: number; data: any } | null = null;
let cachedAutoInjectHook: ((event: any) => Promise<void>) | null = null;
let cachedLiveCaptureHook: ((event: any) => Promise<void>) | null = null;
let cachedRag: any = null;
let cachedAdvisory: any = null;
let cachedWorkingMemory: any = null;
let cachedSourceFreshness = new Map<string, { expiresAt: number; fresh: boolean }>();

function nowIso(): string {
  return new Date().toISOString();
}

function sha(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeWhitespace(value: unknown): string {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLiveMessagingPrompt(prompt: string): boolean {
  if (!prompt) return false;
  return [
    /Conversation info \(untrusted metadata\)/i,
    /Sender \(untrusted metadata\)/i,
    /UNTRUSTED (?:Discord|Slack|Telegram|WhatsApp) message body/i,
    /Discord channel topic:/i,
    /"is_group_chat"\s*:/i,
    /"group_channel"\s*:/i,
    /"conversation_label"\s*:/i,
  ].some((re) => re.test(prompt));
}

function truncate(value: unknown, maxChars: number): string {
  const text = normalizeWhitespace(value);
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function relativeTimeMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function slugifyPathSegment(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "shared";
}

function extractAgentId(sessionKey?: string): string | undefined {
  if (!sessionKey || typeof sessionKey !== "string") return undefined;
  const parts = sessionKey.split(":");
  return parts.length >= 2 ? parts[1] : undefined;
}

function extractLiveMessageBody(prompt: string): string {
  const normalized = normalizeWhitespace(prompt);
  if (!normalized) return "";

  const bodyMatches = Array.from(
    normalized.matchAll(
      /UNTRUSTED (?:Discord|Slack|Telegram|WhatsApp) message body\s+([\s\S]+?)(?=<<<END_EXTERNAL_UNTRUSTED_CONTENT|\n(?:Conversation info|Sender|Replied message|System \(untrusted\)|Source:)|$)/gi,
    ),
  );
  const body = normalizeWhitespace(bodyMatches.at(-1)?.[1]);
  if (body.length >= 3) return body;

  const bodyJsonMatches = Array.from(
    normalized.matchAll(/"body"\s*:\s*"((?:\\.|[^"\\])*)"/g),
  );
  const rawJsonBody = bodyJsonMatches.at(-1)?.[1];
  if (rawJsonBody) {
    try {
      const parsed = JSON.parse(`"${rawJsonBody}"`);
      const text = normalizeWhitespace(parsed);
      if (text.length >= 3) return text;
    } catch {
      // Fall through to generic extraction.
    }
  }

  return "";
}

function stripSystemicPromptPrefix(prompt: string): string {
  let text = normalizeWhitespace(prompt);
  if (!text) return "";

  const externalBody = extractLiveMessageBody(text);
  if (externalBody) return externalBody;

  text = text.replace(/^File delivery rule:[\s\S]+?(?=\n(?:BrainX recall|Conversation info|Sender|Replied message|Untrusted context|<<<EXTERNAL_UNTRUSTED_CONTENT)|$)/i, "");
  text = text.replace(/^BrainX recall[\s\S]+?(?=\n(?:File delivery rule|Conversation info|Sender|Replied message|Untrusted context|<<<EXTERNAL_UNTRUSTED_CONTENT)|$)/i, "");
  text = text.replace(/^\[media attached:[^\]\n]*\]\s*/i, "");
  text = text.replace(/^\[media attached \d+\/\d+:[^\]\n]*\]\s*/i, "");
  text = text.replace(/^Conversation info \(untrusted metadata\):[\s\S]+?(?=\n(?:Sender|Replied message|Untrusted context|<<<EXTERNAL_UNTRUSTED_CONTENT)|$)/i, "");
  text = text.replace(/^Sender \(untrusted metadata\):[\s\S]+?(?=\n(?:Replied message|Untrusted context|<<<EXTERNAL_UNTRUSTED_CONTENT)|$)/i, "");

  return normalizeWhitespace(text);
}

function extractQuestionFromWrappedPrompt(prompt: string): string {
  const normalized = stripSystemicPromptPrefix(prompt);
  if (!normalized) return "";

  const labelledMatches = Array.from(
    normalized.matchAll(/\b(?:pregunta|question|actual question|user question|consulta)\b\s*:\s*([\s\S]+?)(?=(?:\b(?:respuesta?|answer|output)\b\s*:)|$)/gi),
  );
  const labelled = normalizeWhitespace(labelledMatches.at(-1)?.[1]);
  if (labelled.length >= 8) return labelled;

  const segments = normalized
    .split(/(?:\n+|(?<=[.!?])\s+(?=(?:[A-ZÁÉÍÓÚÑ¿]|Pregunta\b|Question\b|Consulta\b)))/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const candidate = [...segments]
    .reverse()
    .find((part) => {
      if (part.length < 8) return false;
      if (/^(?:no uses|no leas|no cites|responde|devuelve|answer|respond|return|do not|dont)\b/i.test(part)) {
        return false;
      }
      return /[?？]$/.test(part) || /^¿/.test(part);
    });

  return candidate || normalized;
}

function buildPromptQuery(prompt: string): string {
  // Keep JIT query anchored to the user's current ask only.
  // The conversation itself is already in the model context; pulling recent
  // user messages into the retrieval query was causing stale/solved topics to
  // leak back into recall.
  return truncate(extractQuestionFromWrappedPrompt(prompt), 1600);
}

function tokenizeSearchText(value: string): string[] {
  return Array.from(
    new Set(
      (normalizeWhitespace(value).toLowerCase().match(/[\p{L}\p{N}_./:-]+/gu) || [])
        .filter((token) => token.length >= 3)
        .filter((token) => !DIRECT_MATCH_STOP_WORDS.has(token)),
    ),
  );
}

function extractPromptTerms(prompt: string): string[] {
  return tokenizeSearchText(buildPromptQuery(prompt));
}

function isHistoricalPrompt(prompt: string): boolean {
  const text = normalizeWhitespace(prompt).toLowerCase();
  if (!text) return false;
  return /\b(qué se decidió|que se decidió|qué decidimos|que decidimos|qué cambió|que cambió|que cambio|qué pasó|que pasó|timeline|historial|history|what changed|what did we decide|decision|decisión|decisiones|before|antes|últimos días|ultimos dias|previously|earlier)\b/i.test(text);
}

function isTroubleshootingPrompt(prompt: string): boolean {
  return TROUBLESHOOTING_PROMPT_RE.test(normalizeWhitespace(prompt));
}

function shouldInjectWikiDigest(prompt: string, config: BrainxBridgeConfig): boolean {
  if (!config.wikiDigest) return false;
  const normalized = normalizeWhitespace(prompt);
  if (normalized.length < 12) return false;
  if (isLiveMessagingPrompt(normalized)) return false;
  if (!config.wikiDigestPromptSignalsOnly) return true;
  return WIKI_DIGEST_SIGNAL_RE.test(normalized);
}

function isRecentRow(row: any, maxAgeDays: number): boolean {
  const candidate = row?.last_seen || row?.resolved_at || row?.created_at || row?.first_seen;
  const parsed = candidate ? Date.parse(String(candidate)) : NaN;
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed <= maxAgeDays * 24 * 60 * 60 * 1000;
}

function isCurrentIssueRow(row: any): boolean {
  const status = String(row?.status || "").toLowerCase();
  const category = String(row?.category || "").toLowerCase();
  const tags = Array.isArray(row?.tags) ? row.tags.map((tag: unknown) => String(tag).toLowerCase()) : [];
  const verification = String(row?.verification_state || "").toLowerCase();
  if (!["pending", "in_progress"].includes(status)) return false;
  if (verification !== "changelog" && !tags.some((tag: string) => tag.includes("tool-failure"))) return false;
  if (["error", "correction", "infrastructure"].includes(category)) return true;
  return tags.some((tag: string) => tag.includes("tool-failure") || tag.startsWith("tool:"));
}

function buildRowHaystack(row: any): string {
  return [
    row?.content,
    row?.context,
    row?.category,
    row?.pattern_key,
    row?.resolution_notes,
    row?.source_path,
    Array.isArray(row?.tags) ? row.tags.join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function countPromptTermHits(row: any, promptTerms: string[]): { hits: number; strongHits: number } {
  if (!promptTerms.length) return { hits: 0, strongHits: 0 };
  const haystack = buildRowHaystack(row);
  let hits = 0;
  let strongHits = 0;

  for (const term of promptTerms) {
    if (!haystack.includes(term)) continue;
    hits += 1;
    if (term.length >= 6 || /[./:_-]/.test(term)) strongHits += 1;
  }

  return { hits, strongHits };
}

function rowMatchesPrompt(
  row: any,
  promptTerms: string[],
  { troubleshootingPrompt = false }: { troubleshootingPrompt?: boolean } = {},
): boolean {
  const similarity = Number(row?.similarity ?? 0);
  if (!promptTerms.length) return similarity >= (troubleshootingPrompt ? 0.66 : 0.72);

  const { hits, strongHits } = countPromptTermHits(row, promptTerms);
  if (hits <= 0) return false;

  const minHits = promptTerms.length >= 4 ? 2 : 1;
  if (hits >= minHits && (strongHits >= 1 || similarity >= 0.7)) return true;
  if (troubleshootingPrompt && isCurrentIssueRow(row) && hits >= 1) return true;
  return false;
}

function extractSourceFilePath(sourcePath: unknown): string | null {
  const raw = normalizeWhitespace(sourcePath);
  if (!raw || !raw.startsWith("/")) return null;
  const first = raw.split("|")[0]?.trim() || raw;
  return first.startsWith("/") ? first : null;
}

function getRowTimestampMs(row: any): number | null {
  const candidate = row?.last_seen || row?.created_at || row?.first_seen || row?.resolved_at;
  const parsed = candidate ? Date.parse(String(candidate)) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

async function isRowFreshAgainstSource(row: any): Promise<boolean> {
  const sourceKind = String(row?.source_kind || "");
  if (!SOURCE_FRESHNESS_KINDS.has(sourceKind)) return true;

  const sourceFile = extractSourceFilePath(row?.source_path);
  const rowTs = getRowTimestampMs(row);
  if (!sourceFile || rowTs == null) return true;

  const cacheKey = `${sourceFile}:${rowTs}`;
  const cached = cachedSourceFreshness.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.fresh;

  let fresh = true;
  try {
    const stat = await fs.stat(sourceFile);
    fresh = stat.mtimeMs <= rowTs + SOURCE_FRESHNESS_CACHE_TTL_MS;
  } catch {
    fresh = true;
  }

  cachedSourceFreshness.set(cacheKey, {
    expiresAt: Date.now() + SOURCE_FRESHNESS_CACHE_TTL_MS,
    fresh,
  });
  return fresh;
}

function sortRecallResults(rows: any[], agentId?: string, recencyDecayDays: number = 30): any[] {
  const typePriority: Record<string, number> = { gotcha: 0, decision: 1, fact: 2 };
  return [...rows].sort((a, b) => {
    const aLocal = !a?.agent || (agentId && a.agent === agentId) ? 0 : 1;
    const bLocal = !b?.agent || (agentId && b.agent === agentId) ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;
    const ta = typePriority[String(a.type)] ?? 99;
    const tb = typePriority[String(b.type)] ?? 99;
    if (ta !== tb) return ta - tb;
    const sa = computeSignalScore(a, recencyDecayDays);
    const sb = computeSignalScore(b, recencyDecayDays);
    if (sa !== sb) return sb - sa;
    return Number(b.score || 0) - Number(a.score || 0);
  });
}

// Bootstrap injects top memories into <workspace>/MEMORY.md between BRAINX
// markers; jit recall could resurface the same row in the prompt. Hash the
// truncated MEMORY.md lines and skip jit candidates that match. Truncation in
// MEMORY.md is 147 chars (own/team) or 120 chars (cross-agent), so fingerprint
// the first 100 chars of normalized lowercase content to match either form.
const MEMORY_MD_BRAINX_START = "<!-- BRAINX:START -->";
const MEMORY_MD_BRAINX_END = "<!-- BRAINX:END -->";
const MEMORY_MD_LINE_RE = /^- \*\*\[[^\]]+\]\*\*\s+(.+?)\s*$/gm;
const MEMORY_MD_FINGERPRINT_LEN = 100;

function fingerprintMemoryContent(content: unknown): string | null {
  const normalized = normalizeWhitespace(content).toLowerCase();
  if (normalized.length < 16) return null;
  const trimmed = normalized.endsWith("...") ? normalized.slice(0, -3).trimEnd() : normalized;
  if (trimmed.length < 16) return null;
  return sha(trimmed.slice(0, MEMORY_MD_FINGERPRINT_LEN)).slice(0, 16);
}

function extractMemoryMdFingerprints(content: string): Set<string> {
  const out = new Set<string>();
  if (!content) return out;
  const startIdx = content.lastIndexOf(MEMORY_MD_BRAINX_START);
  const endIdx = content.lastIndexOf(MEMORY_MD_BRAINX_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return out;
  const section = content.slice(startIdx + MEMORY_MD_BRAINX_START.length, endIdx);
  MEMORY_MD_LINE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MEMORY_MD_LINE_RE.exec(section)) !== null) {
    const fp = fingerprintMemoryContent(match[1]);
    if (fp) out.add(fp);
  }
  return out;
}

const MEMORY_MD_FINGERPRINT_CACHE = new Map<string, { mtimeMs: number; fingerprints: Set<string> }>();

async function loadMemoryMdFingerprints(agentId?: string): Promise<Set<string>> {
  try {
    const wd = await resolveWorkspaceDir(agentId);
    if (!wd) return new Set();
    const memPath = path.join(wd, "MEMORY.md");
    const stat = await fs.stat(memPath);
    const cached = MEMORY_MD_FINGERPRINT_CACHE.get(memPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.fingerprints;
    const content = await fs.readFile(memPath, "utf-8");
    const fingerprints = extractMemoryMdFingerprints(content);
    MEMORY_MD_FINGERPRINT_CACHE.set(memPath, { mtimeMs: stat.mtimeMs, fingerprints });
    return fingerprints;
  } catch {
    return new Set();
  }
}

function selectRecallRows(
  rows: any[],
  agentId: string | undefined,
  limit: number,
  recencyDecayDays: number = 30,
): any[] {
  const selected: any[] = [];
  const seen = new Set<string>();
  const perType = new Map<string, number>();

  for (const row of sortRecallResults(rows, agentId, recencyDecayDays)) {
    const content = normalizeWhitespace(row?.content);
    if (!content) continue;
    const key = sha(content.toLowerCase()).slice(0, 16);
    if (seen.has(key)) continue;
    const type = String(row?.type || "note");
    const count = perType.get(type) ?? 0;
    if (count >= 2) continue;
    seen.add(key);
    perType.set(type, count + 1);
    selected.push(row);
    if (selected.length >= limit) break;
  }

  return selected;
}

function truncateKeepingBothEnds(value: unknown, maxChars: number): string {
  const text = normalizeWhitespace(value);
  if (text.length <= maxChars) return text;
  if (maxChars <= 24) return truncate(text, maxChars);

  const keep = Math.max(8, Math.floor((maxChars - 1) / 2));
  const head = text.slice(0, keep).trimEnd();
  const tail = text.slice(-keep).trimStart();
  return `${head}…${tail}`;
}

function labelRecallRow(row: any, { troubleshootingPrompt = false }: { troubleshootingPrompt?: boolean } = {}): string {
  if (isCurrentIssueRow(row)) return "LIVE ISSUE";
  if (troubleshootingPrompt && SOLUTION_SIGNAL_RE.test(normalizeWhitespace(row?.content))) return "KNOWN FIX";
  const type = String(row?.type || "note").toUpperCase();
  return type === "GOTCHA" ? "GOTCHA" : type;
}

function formatRecallBlock(
  rows: any[],
  maxChars: number,
  { troubleshootingPrompt = false }: { troubleshootingPrompt?: boolean } = {},
): string | null {
  if (!rows.length) return null;
  const header = "BrainX recall — usa solo lo que sea directamente relevante; si choca con código/runtime/logs, manda la evidencia viva.";
  const lines = [header];
  const usableChars = Math.max(240, maxChars - header.length - 32);
  const rowBudget = Math.max(220, Math.min(420, Math.floor(usableChars / Math.max(rows.length, 1)) - 28));

  for (const row of rows) {
    const label = labelRecallRow(row, { troubleshootingPrompt });
    const verification = String(row.verification_state || "unknown");
    const sourceKind = String(row.source_kind || "unknown");
    const recurrence = Number(row?.recurrence_count || 0) > 1 ? ` x${row.recurrence_count}` : "";
    lines.push(`- ${label}${recurrence} [${verification}/${sourceKind}]: ${truncateKeepingBothEnds(row.content, rowBudget)}`);
  }

  return truncate(lines.join("\n"), maxChars);
}

function isVerifiedInferenceRowAllowed(
  row: any,
  { troubleshootingPrompt = false }: { troubleshootingPrompt?: boolean } = {},
): boolean {
  const confidence = Number(row?.confidence_score ?? 0);
  const tags = Array.isArray(row?.tags) ? row.tags.map((tag: unknown) => String(tag)) : [];
  const category = String(row?.category || "");
  const recent = isRecentRow(row, troubleshootingPrompt ? 21 : 14);
  const calibrated = tags.includes("calibrated_verified") || confidence >= 0.82;
  return recent && (calibrated || ["infrastructure", "project_registry", "best_practice", "correction", "error"].includes(category));
}

const ROW_AGE_CACHE = new WeakMap<object, number>();
function rowAgeDays(row: any): number {
  if (row && typeof row === "object") {
    const cached = ROW_AGE_CACHE.get(row);
    if (typeof cached === "number") return cached;
  }
  const candidates = [row?.updated_at, row?.last_accessed_at, row?.created_at];
  let result = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const t = new Date(candidate).getTime();
    if (Number.isFinite(t)) {
      result = Math.max(0, (Date.now() - t) / 86_400_000);
      break;
    }
  }
  if (row && typeof row === "object") ROW_AGE_CACHE.set(row, result);
  return result;
}

function computeSignalScore(row: any, decayDays: number): number {
  const importance = Math.max(1, Math.min(10, Number(row?.importance ?? 5)));
  const similarity = Math.max(0, Math.min(1, Number(row?.similarity ?? 0)));
  const verification = String(row?.verification_state || "hypothesis").toLowerCase();
  const verifiedBoost = verification === "verified" ? 1.25 : verification === "hypothesis" ? 1.0 : 0.6;
  const accessCount = Math.max(0, Number(row?.access_count ?? 0));
  const ageFactor = Math.exp(-rowAgeDays(row) / Math.max(1, decayDays));
  const usageBoost = 1 + Math.min(0.5, Math.log1p(accessCount) / 6);
  return similarity * importance * ageFactor * verifiedBoost * usageBoost;
}

function passesSignalGate(
  row: any,
  {
    minImportance,
    minSimilarity,
    staleDays,
  }: { minImportance: number; minSimilarity: number; staleDays: number },
): boolean {
  if (!row) return false;
  const importance = Number(row.importance ?? 0);
  if (importance < minImportance) return false;
  const similarity = Number(row.similarity ?? 0);
  if (similarity < minSimilarity) return false;
  // If access_count column is missing/NULL we must NOT penalize by staleness
  // (pre-upgrade schemas, COUNT(*) projections, etc.).
  const rawAccess = row?.access_count;
  const hasAccessCount = rawAccess !== undefined && rawAccess !== null && Number.isFinite(Number(rawAccess));
  if (hasAccessCount && Number(rawAccess) === 0 && rowAgeDays(row) > staleDays) return false;
  return true;
}

function extractShingleTokens(text: string): Set<string> {
  const normalized = String(text || "").toLowerCase();
  const tokens = normalized.match(/[\p{L}\p{N}][\p{L}\p{N}_./:-]{2,}/gu) || [];
  const stop = new Set([
    "the", "and", "for", "that", "this", "with", "from", "into", "have", "has", "but",
    "you", "your", "are", "was", "were", "can", "not", "all", "any", "como", "para", "que",
    "los", "las", "del", "una", "uno", "por", "con", "sin", "pero", "mas", "menos", "sobre",
  ]);
  const out = new Set<string>();
  for (const tok of tokens) {
    if (tok.length < 4) continue;
    if (stop.has(tok)) continue;
    out.add(tok);
  }
  return out;
}

function contentOverlapRatio(content: string, promptShingles: Set<string>): number {
  if (!promptShingles.size) return 0;
  const contentShingles = extractShingleTokens(content);
  if (!contentShingles.size) return 0;
  let hits = 0;
  for (const tok of contentShingles) if (promptShingles.has(tok)) hits++;
  return hits / contentShingles.size;
}

// ============================================================
// Silent-by-default: trigger gate + per-turn budget
// ============================================================
// A prompt only gets BrainX injection when it either asks for memory
// explicitly or shows a domain signal. Anything else leaves the prompt clean.
const EXPLICIT_RECALL_RX =
  /\b(recall|brainx|recorda|recuerda|qu[eé]\s+(sabemos|record[aá]s|ten[eé]mos)|memoria|context[\s_-]?pack|hist[oó]ric[oa]|antecedent)/i;

// VOCAB_EXPAND_20260419: domain signal now covers the 33 knowledge categories
// brainx actually stores content for (finanzas, correos, propuestas, marketing,
// ventas, legal, clientes, etc.) in addition to the technical stack. Split in
// themed regexes for readability and easier future extension.
const DOMAIN_SIGNAL_TECH_RX =
  /\b(agent|engineering|writing|research|operations|support|acp|openclaw|codex|gateway|discord|telegram|slack|whatsapp|systemd|cron|hook|plugin|skill|agent[_-]?core|llm|claude|gpt|gemini|deploy|rollback|migration|restart|reload|crash|timeout|oauth|embed|vector|pgvector|postgres|trajectory|workspace|upgrade|patch|bug|fix|regressi[oó]n|brainx|railway|vercel|notion|gmail|figma|api|endpoint|backend|frontend|dashboard|server|base\s*de\s*datos|db|script|funci[oó]n|variable|config|test|prueba|log|commit|push|pull|merge|branch|repo|repositorio|release|hotfix)\b/i;
const DOMAIN_SIGNAL_FINANCE_RX =
  /\b(factura|facturaci[oó]n|invoice|billing|pago|cobro|cobranza|ingreso|egreso|gasto|cuenta|banco|transferencia|stripe|paypal|mercadopago|wise|impuesto|iva|arancel|comisi[oó]n|precio|costo|presupuesto|budget|payment|tax|n[oó]mina|payroll|saldo|deuda|cr[eé]dito|d[eé]bito|econom[ií]a|finanzas|financiero|trading|trade|inversi[oó]n|inversion|investment|mercado|market|acci[oó]n|stock|crypto|cripto|bitcoin|bolsa|interes)\b/i;
const DOMAIN_SIGNAL_CLIENTS_RX =
  /\b(cliente|prospect|lead|propuesta|cotizaci[oó]n|oferta|venta|sale|sales|deal|negociaci[oó]n|pipeline|crm|customer|account|contrato|contract|acuerdo|nda|t[eé]rminos|condiciones|cl[aá]usula|onboarding|renovaci[oó]n|upsell|downsell|churn|retenci[oó]n|partnership|partner|alianza|vendor|proveedor)\b/i;
const DOMAIN_SIGNAL_MARKETING_RX =
  /\b(marketing|seo|sem|ads|anuncio|anuncios|campa[nñ]a|campaign|keyword|ranking|backlink|analytics|conversi[oó]n|funnel|lead[\s_-]?magnet|landing|copy|copywriting|brand|branding|marca|logo|identidad|color|tipograf[ií]a|email[\s_-]?marketing|newsletter|segment|audiencia|target|persona|buyer|traffic|tr[aá]fico|impresiones|ctr|cpa|cpc|roi|roas|influencer|colaboraci[oó]n)\b/i;
const DOMAIN_SIGNAL_CONTENT_RX =
  /\b(contenido|content|post|art[ií]culo|article|blog|video|reel|historia|story|shorts|caption|hook|gui[oó]n|script|edici[oó]n|publicaci[oó]n|draft|borrador|thread|tweet|tuit|instagram|twitter|x|facebook|tiktok|linkedin|youtube|pinterest|medium|substack|social|redes|social[\s_-]?media|feed|perfil|bio)\b/i;
const DOMAIN_SIGNAL_COMMS_RX =
  /\b(correo|email|mail|inbox|bandeja|respuesta|reply|forward|reenv[ií]o|newsletter|boletin|suscripci[oó]n|suscriptor|slack|telegram|whatsapp|wa|sms|mensaje|dm|pm|mention|menci[oó]n|llamada|call|reuni[oó]n|meeting|zoom|google\s*meet|agenda|calendario|calendar|cita|appointment)\b/i;
const DOMAIN_SIGNAL_PRODUCT_RX =
  /\b(producto|product|feature|roadmap|dise[nñ]o|design|ui|ux|mockup|prototipo|prototype|figma|wireframe|component|componente|sistema[\s_-]?de[\s_-]?dise[nñ]o|design[\s_-]?system|usabilidad|usability|user[\s_-]?flow|journey|persona|stakeholder|release)\b/i;
const DOMAIN_SIGNAL_OPS_RX =
  /\b(operaciones|operations|proceso|workflow|tarea|task|kanban|trello|asana|notion|automatizaci[oó]n|automation|plantilla|template|checklist|sop|procedimiento|contrataci[oó]n|hiring|empleado|empleada|freelancer|equipo|team|manager|l[ií]der|delegaci[oó]n|delegation|delivery|deadline|vencimiento|entrega)\b/i;
const DOMAIN_SIGNAL_LEGAL_RX =
  /\b(legal|contrato|contract|acuerdo|nda|t[eé]rmino|condici[oó]n|cl[aá]usula|ley|law|normativa|compliance|regulaci[oó]n|propiedad[\s_-]?intelectual|copyright|trademark|marca[\s_-]?registrada|privacidad|privacy|gdpr|licencia|license)\b/i;
const DOMAIN_SIGNAL_RESEARCH_RX =
  /\b(research|investigaci[oó]n|an[aá]lisis|analysis|estudio|estudios|paper|informe|report|reporte|datos|data|estad[ií]stica|statistic|survey|encuesta|metric|m[eé]trica|kpi|dashboard)\b/i;
const DOMAIN_SIGNAL_ACTIONS_RX =
  /\b(hacer|crear|implementar|probar|revisar|buscar|mostrar|generar|publicar|enviar|analizar|instalar|ejecutar|escribir|redactar|traducir|resumir|listar|comparar|evaluar|aprobar|rechazar|actualizar|migrar|exportar|importar|descargar|subir|eliminar|borrar|modificar|ajustar|configurar|optimizar|mejorar|arreglar|resolver|contactar|responder|preguntar|ayudar|recomendar|proponer|sugerir|documentar|planificar|organizar|programar|agendar|recordar|calcular|consultar|presentar|explicar|demostrar|validar|verificar|confirmar|cancelar|pausar|reactivar|ayuda|consejo|idea|consulta|duda)\b/i;
const DOMAIN_SIGNAL_ENTITIES_RX =
  /\b(company|client|project|product|brand|workspace|repository|repo|service|integration|platform)\b/i;

function hasDomainSignal(text: string): boolean {
  return (
    DOMAIN_SIGNAL_TECH_RX.test(text)
    || DOMAIN_SIGNAL_FINANCE_RX.test(text)
    || DOMAIN_SIGNAL_CLIENTS_RX.test(text)
    || DOMAIN_SIGNAL_MARKETING_RX.test(text)
    || DOMAIN_SIGNAL_CONTENT_RX.test(text)
    || DOMAIN_SIGNAL_COMMS_RX.test(text)
    || DOMAIN_SIGNAL_PRODUCT_RX.test(text)
    || DOMAIN_SIGNAL_OPS_RX.test(text)
    || DOMAIN_SIGNAL_LEGAL_RX.test(text)
    || DOMAIN_SIGNAL_RESEARCH_RX.test(text)
    || DOMAIN_SIGNAL_ACTIONS_RX.test(text)
    || DOMAIN_SIGNAL_ENTITIES_RX.test(text)
  );
}

const IDENTIFIER_RX =
  /([A-Z][a-z]+[A-Z][a-zA-Z]+|\/[\w.-]+\/[\w.-]+|\w+Error|\w+\.(?:ts|js|mjs|cjs|tsx|jsx|py|go|rs|sql|md|json|sh)\b|#\d{3,}|PR\s?#?\d+|v\d+\.\d+\.\d+|\b\d{4}-\d{2}-\d{2}\b|\$\d+|\d+%|\b\d+[kKmM]\b)/;
const ACK_PREFIX_RX =
  /^(s[ií]|no|ok(?:ay)?|dale|listo|gracias|perfecto|entendido|claro|correcto|bueno|bien)\b[\s,.:!-]*$/i;
const TRIGGER_MIN_CHARS = 25;
const TRIGGER_ACK_MAX_CHARS = 60;

type TriggerDecision = { fire: boolean; reason: string };

function shouldTriggerInjection(prompt: string): TriggerDecision {
  const trimmed = extractQuestionFromWrappedPrompt(prompt);
  if (trimmed.length < TRIGGER_MIN_CHARS) return { fire: false, reason: "short" };
  if (ACK_PREFIX_RX.test(trimmed) && trimmed.length < TRIGGER_ACK_MAX_CHARS) return { fire: false, reason: "ack" };
  if (EXPLICIT_RECALL_RX.test(trimmed)) return { fire: true, reason: "explicit" };
  if (hasDomainSignal(trimmed)) return { fire: true, reason: "domain" };
  if (IDENTIFIER_RX.test(trimmed)) return { fire: true, reason: "identifier" };
  return { fire: false, reason: "no-signal" };
}

// Hard per-turn budget. One surface per turn, bounded chars. Keeps the
// prompt quiet even when multiple surfaces would otherwise fire.
const TURN_BUDGET_CHARS = 800;
const TURN_STATE_TTL_MS = 5 * 60_000;
const TURN_STATE = new Map<string, { chars: number; surfaces: Set<string>; expiresAt: number }>();

function pruneTurnState(): void {
  const now = Date.now();
  for (const [k, v] of TURN_STATE) if (v.expiresAt < now) TURN_STATE.delete(k);
}

function makeTurnKey(ctx: any, prompt: string): string {
  const sessionId = ctx?.sessionId || ctx?.sessionKey || ctx?.agentId || "unknown";
  return `${sessionId}:${sha(String(prompt || "")).slice(0, 12)}`;
}

function reserveTurnBudget(turnKey: string, surface: string, chars: number): boolean {
  if (!chars || chars <= 0) return false;
  pruneTurnState();
  const st =
    TURN_STATE.get(turnKey) ??
    { chars: 0, surfaces: new Set<string>(), expiresAt: Date.now() + TURN_STATE_TTL_MS };
  if (st.surfaces.size >= 1) return false;
  if (st.chars + chars > TURN_BUDGET_CHARS) return false;
  st.chars += chars;
  st.surfaces.add(surface);
  st.expiresAt = Date.now() + TURN_STATE_TTL_MS;
  TURN_STATE.set(turnKey, st);
  return true;
}

// Closed whitelist for tool advisories. Tools outside this set never
// trigger a BrainX advisory lookup, regardless of isHighRisk() heuristics.
const ADVISORY_TOOL_WHITELIST = new Set<string>([
  "bash",
  "bash.exec",
  "exec",
  "shell",
  "run",
  "write",
  "edit",
  "notebookedit",
  "write_file",
  "str_replace_editor",
  "str_replace_based_edit_tool",
  "browser.navigate",
  "browser.click",
  "browser.fill",
  "browser.type",
  "browser.press",
  "browser.evaluate",
  "playwright.navigate",
  "playwright.click",
  "sql.query",
  "sql.execute",
  "db.query",
  "db.migrate",
  "db.execute",
  "postgres.query",
  "git.push",
  "git.reset",
  "git.force",
  "git.rebase",
  "git.merge",
  "gh.pr.merge",
  "deploy",
  "rollback",
  "systemctl",
  "service.restart",
]);

function isAdvisoryToolAllowed(toolName: string): boolean {
  const normalized = String(toolName || "").toLowerCase().trim();
  if (!normalized) return false;
  if (ADVISORY_TOOL_WHITELIST.has(normalized)) return true;
  // Fuzzy match a couple of common variants (e.g., "Bash", "bash_tool").
  for (const allowed of ADVISORY_TOOL_WHITELIST) {
    if (normalized === allowed) return true;
    if (normalized.startsWith(allowed + "_") || normalized.startsWith(allowed + "-") || normalized.startsWith(allowed + ".")) return true;
  }
  return false;
}

function isCrossAgentRowAllowed(
  row: any,
  agentId: string | undefined,
  {
    allowCrossAgent,
    crossAgentTagRequired,
    crossAgentRequireVerified,
  }: {
    allowCrossAgent: boolean;
    crossAgentTagRequired: boolean;
    crossAgentRequireVerified: boolean;
  },
): boolean {
  // Memories without an agent (NULL) are global/shared - always allowed
  const rowAgent = row?.agent;
  if (!rowAgent) return true;

  // Same agent - always allowed
  const normalizedRowAgent = String(rowAgent).trim().toLowerCase();
  const normalizedTargetAgent = String(agentId || "").trim().toLowerCase();
  if (normalizedTargetAgent && normalizedRowAgent === normalizedTargetAgent) return true;

  // Different agent - apply cross-agent guards
  if (!allowCrossAgent) return false;

  if (crossAgentTagRequired) {
    const tags = Array.isArray(row?.tags) ? row.tags.map((t: unknown) => String(t).toLowerCase()) : [];
    if (!tags.includes("cross-agent")) return false;
  }

  if (crossAgentRequireVerified) {
    const verification = String(row?.verification_state || "hypothesis").toLowerCase();
    if (verification !== "verified") return false;
  }

  return true;
}

async function shouldRecallRow(
  row: any,
  agentId: string | undefined,
  promptTerms: string[],
  minSimilarity: number,
  {
    allowHistoricalChangelog = false,
    troubleshootingPrompt = false,
    allowCrossAgent = false,
    crossAgentTagRequired = true,
    crossAgentRequireVerified = true,
    signalGate = null,
  }: {
    allowHistoricalChangelog?: boolean;
    troubleshootingPrompt?: boolean;
    allowCrossAgent?: boolean;
    crossAgentTagRequired?: boolean;
    crossAgentRequireVerified?: boolean;
    signalGate?: { minImportance: number; minSimilarity: number; staleDays: number } | null;
  } = {},
): Promise<boolean> {
  if (!row) return false;
  if (!ALLOWED_RECALL_TYPES.has(String(row.type))) return false;
  if (!["hot", "warm"].includes(String(row.tier))) return false;
  if (Number(row.similarity ?? 0) < minSimilarity) return false;
  if (signalGate && !passesSignalGate(row, signalGate)) return false;
  if (!isCrossAgentRowAllowed(row, agentId, { allowCrossAgent, crossAgentTagRequired, crossAgentRequireVerified })) return false;
  if (!rowMatchesPrompt(row, promptTerms, { troubleshootingPrompt })) return false;
  if (!(await isRowFreshAgainstSource(row))) return false;

  const sourceKind = String(row.source_kind || "");
  const verification = String(row.verification_state || "hypothesis");

  if (verification === "verified") {
    if (PRIMARY_ALLOWED_SOURCE_KINDS.has(sourceKind)) return true;
    if (SECONDARY_ALLOWED_SOURCE_KINDS.has(sourceKind)) {
      return isVerifiedInferenceRowAllowed(row, { troubleshootingPrompt });
    }
    return allowHistoricalChangelog && HISTORICAL_ALLOWED_SOURCE_KINDS.has(sourceKind) && isRecentRow(row, 7);
  }

  if (verification !== "changelog") return false;
  if (troubleshootingPrompt && isCurrentIssueRow(row) && isRecentRow(row, 7)) return true;
  return Boolean(
    allowHistoricalChangelog &&
      agentId &&
      row.agent === agentId &&
      isRecentRow(row, 14),
  );
}

async function filterRecallRows(
  rows: any[],
  agentId: string | undefined,
  promptTerms: string[],
  minSimilarity: number,
  options: {
    allowHistoricalChangelog?: boolean;
    troubleshootingPrompt?: boolean;
    allowCrossAgent?: boolean;
    crossAgentTagRequired?: boolean;
    crossAgentRequireVerified?: boolean;
    signalGate?: { minImportance: number; minSimilarity: number; staleDays: number } | null;
  } = {},
): Promise<any[]> {
  const verdicts = await Promise.all(
    rows.map(async (row) => ({
      row,
      ok: await shouldRecallRow(row, agentId, promptTerms, minSimilarity, options),
    })),
  );
  return verdicts.filter((entry) => entry.ok).map((entry) => entry.row);
}

function pendingKey(ctx: any, event: any): string {
  return [ctx?.runId || "no-run", ctx?.toolCallId || event?.toolCallId || "no-call", event?.toolName || ctx?.toolName || "unknown"].join(":");
}

function shouldCaptureFailure(toolName: string, error: string): boolean {
  if (!toolName || !error) return false;
  const normalized = toolName.toLowerCase();
  if (!(HIGH_RISK_FALLBACK_TOOLS.has(normalized) || normalized === "exec")) return false;
  return /failed|error|denied|timeout|timed out|not found|permission|invalid|aborted|exited with code/i.test(error);
}

function firstNonEmptyString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = normalizeWhitespace(value);
      if (normalized) return normalized;
    }
  }
  return "";
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return false;
}

function extractToolFailureInfo(event: any): { errorText: string | null; isFailure: boolean } {
  const directError = firstNonEmptyString([event?.error]);
  if (directError) {
    return { errorText: truncate(directError, 300), isFailure: true };
  }

  const result = asObject(event?.result);
  const details = asObject(result.details);
  const status = firstNonEmptyString([details.status, result.status]).toLowerCase();
  const aggregated = firstNonEmptyString([details.aggregated, result.aggregated]);
  const outputText = firstNonEmptyString([
    aggregated,
    Array.isArray(result.content)
      ? result.content
          .map((entry: any) => (typeof entry?.text === "string" ? entry.text : ""))
          .join("\n")
      : "",
    typeof result.output === "string" ? result.output : "",
    typeof result.text === "string" ? result.text : "",
  ]);
  const exitCode = asNumberOrNull(details.exitCode ?? result.exitCode);
  const timedOut = asBooleanFlag(details.timedOut ?? result.timedOut) || /timed out|timeout/i.test(outputText);

  if (timedOut) {
    const timeoutText = firstNonEmptyString([
      directError,
      outputText,
      `Tool timed out${status ? ` (${status})` : ""}`,
    ]);
    return { errorText: truncate(timeoutText, 300), isFailure: true };
  }

  if (exitCode !== null && exitCode !== 0) {
    const exitText = firstNonEmptyString([
      directError,
      outputText,
      `Process exited with code ${exitCode}`,
    ]);
    return { errorText: truncate(exitText, 300), isFailure: true };
  }

  if (status && !["completed", "ok", "success", "succeeded"].includes(status)) {
    const statusText = firstNonEmptyString([
      directError,
      outputText,
      `Tool failed with status ${status}`,
    ]);
    return { errorText: truncate(statusText, 300), isFailure: true };
  }

  return { errorText: null, isFailure: false };
}

function classifyFailureKind(error: string): string {
  const normalized = normalizeWhitespace(error).toLowerCase();
  if (!normalized) return "unknown";
  if (/timeout|timed out/.test(normalized)) return "timeout";
  if (/permission|denied|forbidden|eacces|eperm/.test(normalized)) return "permission";
  if (/unauthorized|auth|token|credential/.test(normalized)) return "auth";
  if (/not found|enoent|missing/.test(normalized)) return "missing";
  if (/rate.?limit|429/.test(normalized)) return "rate-limit";
  if (/network|socket|econn|dns|unreachable|connection/.test(normalized)) return "network";
  const compact = normalized
    .replace(/\b\d+\b/g, "")
    .replace(/[^a-z]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return compact || sha(normalized).slice(0, 12);
}

function buildToolFailurePatternKey(toolName: string, error: string): string {
  return `tool-failure:${toolName}:${classifyFailureKind(error)}`;
}

function summarizeToolParams(params: Record<string, unknown>): string {
  const preferredKeys = ["command", "workdir", "path", "file", "filePath", "url", "target", "message", "channel", "action"];
  const pairs: string[] = [];
  for (const key of preferredKeys) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) {
      pairs.push(`${key}=${truncate(value, 180)}`);
    }
    if (pairs.length >= 3) break;
  }
  if (pairs.length > 0) return pairs.join(" | ");
  return truncate(JSON.stringify(params), 240);
}

async function readOpenClawConfig(): Promise<any> {
  const configPath = path.join(STATE_DIR, "openclaw.json");
  const stat = await fs.stat(configPath);
  if (cachedOpenClawConfig && cachedOpenClawConfig.mtimeMs === stat.mtimeMs) {
    return cachedOpenClawConfig.data;
  }
  const data = JSON.parse(await fs.readFile(configPath, "utf8"));
  cachedOpenClawConfig = { mtimeMs: stat.mtimeMs, data };
  return data;
}

async function isInternalHookEnabled(name: string): Promise<boolean> {
  try {
    const cfg = await readOpenClawConfig();
    return Boolean(cfg?.hooks?.internal?.enabled && cfg?.hooks?.internal?.entries?.[name]?.enabled);
  } catch {
    return false;
  }
}

async function resolveWorkspaceDir(agentId?: string): Promise<string | null> {
  try {
    const cfg = await readOpenClawConfig();
    const entries = Array.isArray(cfg?.agents?.entries) ? cfg.agents.entries : [];
    const exact = entries.find((entry: any) => entry?.id === agentId || entry?.name === agentId);
    if (typeof exact?.workspace === "string" && exact.workspace.trim()) return exact.workspace.trim();

    const list = Array.isArray(cfg?.agents?.list)
      ? cfg.agents.list
      : cfg?.agents?.list && typeof cfg.agents.list === "object"
        ? Object.entries(cfg.agents.list).map(([id, entry]) => ({ id, ...(asObject(entry)) }))
        : [];
    const exactList = list.find((entry: any) => entry?.id === agentId || entry?.name === agentId || entry?.agentId === agentId);
    if (typeof exactList?.workspace === "string" && exactList.workspace.trim()) return exactList.workspace.trim();
  } catch {
    // fallback below
  }

  if (!agentId || agentId === "main") return path.join(STATE_DIR, "workspace");
  const guessed = path.join(STATE_DIR, `workspace-${agentId}`);
  try {
    await fs.access(guessed);
    return guessed;
  } catch {
    return null;
  }
}

async function importDefaultModule(modulePath: string): Promise<any> {
  const url = pathToFileURL(modulePath).href;
  const mod = await import(url);
  return mod?.default ?? mod;
}

async function getAutoInjectHook(): Promise<(event: any) => Promise<void>> {
  if (cachedAutoInjectHook) return cachedAutoInjectHook;
  cachedAutoInjectHook = await importDefaultModule(path.join(BRAINX_DIR, "hook", "handler.js"));
  return cachedAutoInjectHook as (event: any) => Promise<void>;
}

async function getLiveCaptureHook(): Promise<(event: any) => Promise<void>> {
  if (cachedLiveCaptureHook) return cachedLiveCaptureHook;
  cachedLiveCaptureHook = await importDefaultModule(path.join(BRAINX_DIR, "hook-live", "handler.js"));
  return cachedLiveCaptureHook as (event: any) => Promise<void>;
}

// Warn once per missing BrainX module so upgrades that drop files (tree-shake
// regressions, renames) produce a visible signal instead of a silent catch.
const MISSING_MODULE_WARNED = new Set<string>();
function safeBrainxRequire(relPath: string, label: string): any {
  const absPath = path.join(BRAINX_DIR, relPath);
  try {
    return brainxRequire(absPath);
  } catch (err: any) {
    if (!MISSING_MODULE_WARNED.has(absPath)) {
      MISSING_MODULE_WARNED.add(absPath);
      // eslint-disable-next-line no-console
      console.warn(`[brainx] module ${label} missing at ${absPath} (${err?.message || err}) — feature degraded`);
    }
    throw err;
  }
}

function getRag(): any {
  if (cachedRag) return cachedRag;
  cachedRag = safeBrainxRequire(path.join("lib", "openai-rag.js"), "rag");
  return cachedRag;
}

function getAdvisory(): any {
  if (cachedAdvisory) return cachedAdvisory;
  cachedAdvisory = safeBrainxRequire(path.join("lib", "advisory.js"), "advisory");
  return cachedAdvisory;
}

function getWorkingMemory(): any {
  if (cachedWorkingMemory) return cachedWorkingMemory;
  cachedWorkingMemory = safeBrainxRequire(path.join("lib", "working-memory.js"), "working-memory");
  return cachedWorkingMemory;
}

let cachedDb: any = null;
function getDb(): any {
  if (cachedDb) return cachedDb;
  cachedDb = safeBrainxRequire(path.join("lib", "db.js"), "db");
  return cachedDb;
}

let cachedPhase2: any = null;
function getPhase2(): any {
  if (cachedPhase2) return cachedPhase2;
  cachedPhase2 = safeBrainxRequire(path.join("lib", "brainx-phase2.js"), "phase2");
  return cachedPhase2;
}

// Reuse the canonical PII scrubber from the skill, then apply a second
// env-var-style pass that covers shapes the canonical pattern misses
// (ANTHROPIC_API_KEY=, CLAUDE_CODE_OAUTH_TOKEN=, DATABASE_URL=postgres://u:p@h,
// etc.) — `\b(api|access|secret)_?key\b` skips these because `_` is a word
// char, so `ANTHROPIC_API_KEY` never hits the boundary before `API`.
// Both passes run unconditionally: we do not trust the canonical scrubber to
// cover every leak shape, and the extra pass is cheap.
function scrubSecretsForFailureLog(text: string): string {
  let out = text;
  try {
    const phase2 = getPhase2();
    const scrubbed = phase2?.scrubTextPII?.(out, { enabled: true });
    if (scrubbed && typeof scrubbed.text === "string") out = scrubbed.text;
  } catch {
    // phase2 unavailable — fall through to the local pass only
  }
  return out
    .replace(
      /\b([A-Z][A-Z0-9_]*(?:PASSWORD|PASSWD|TOKEN|SECRET|KEY|API_KEY|AUTH|CREDENTIALS?))\s*=\s*['"]?[^\s'"]{4,}['"]?/g,
      "$1=[REDACTED]",
    )
    .replace(/(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@]+:[^\s@]+@/gi, "$1://[REDACTED]@")
    .replace(/\bBearer\s+[A-Za-z0-9._\-]{16,}\b/gi, "Bearer [REDACTED]");
}

type RuntimeInjectionEntry = {
  id: number;
  surface: string;
  memoryIds: string[];
  contents: string[];
  expiresAt: number;
};
// Map<sessionId, entries[]> — multiple surfaces per turn must all be scored.
const RUNTIME_INJECTION_SESSION_CACHE = new Map<string, RuntimeInjectionEntry[]>();
const RUNTIME_INJECTION_CACHE_TTL_MS = 10 * 60 * 1000;

async function logIntakeGate(params: {
  agent: string | undefined;
  sessionId: string | undefined;
  promptSha: string;
  promptLength: number;
  triggerFired: boolean;
  triggerReason: string | null;
  filterReason: string | null;
  isLiveMessaging: boolean;
  surfacesEnabled: string;
}): Promise<void> {
  try {
    const db = getDb();
    await db.withClient(async (client: any) => {
      await client.query(
        `INSERT INTO brainx_intake_gates
          (agent, session_id, prompt_sha, prompt_length, trigger_fired, trigger_reason,
           filter_reason, is_live_messaging, surfaces_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          params.agent || null,
          params.sessionId || null,
          params.promptSha,
          params.promptLength,
          params.triggerFired,
          params.triggerReason,
          params.filterReason,
          params.isLiveMessaging,
          params.surfacesEnabled,
        ],
      );
    });
  } catch {
    // intake logging is best-effort; never block the hot path
  }
}

async function logRuntimeInjection(params: {
  agent: string | undefined;
  sessionId: string | undefined;
  surface: string;
  rawCount: number;
  filteredCount: number;
  selectedCount: number;
  nearDupDropped: number;
  signalGateDropped: number;
  selectedRows: any[];
  promptSha: string;
  promptPreview: string;
  latencyMs: number;
}): Promise<number | null> {
  try {
    const db = getDb();
    const memoryIds = params.selectedRows.map((r) => String(r?.id || "")).filter((s) => s.length > 0);
    const similarities = params.selectedRows.map((r) => Number(r?.similarity ?? 0));
    const importances = params.selectedRows.map((r) => Number(r?.importance ?? 0));
    const contents = params.selectedRows.map((r) => String(r?.content || ""));
    const res: any = await db.withClient(async (client: any) => {
      return client.query(
        `INSERT INTO brainx_runtime_injections
          (agent, session_id, surface, memory_ids, similarities, importances,
           raw_count, filtered_count, selected_count, near_dup_dropped, signal_gate_dropped,
           prompt_sha, prompt_preview, latency_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          params.agent || null,
          params.sessionId || null,
          params.surface,
          memoryIds,
          similarities,
          importances,
          params.rawCount,
          params.filteredCount,
          params.selectedCount,
          params.nearDupDropped,
          params.signalGateDropped,
          params.promptSha,
          params.promptPreview.slice(0, 400),
          params.latencyMs,
        ],
      );
    });
    const id = Number(res?.rows?.[0]?.id || 0);
    if (id && params.sessionId) {
      const expiresAt = Date.now() + RUNTIME_INJECTION_CACHE_TTL_MS;
      const existing = RUNTIME_INJECTION_SESSION_CACHE.get(params.sessionId) ?? [];
      // Drop expired entries from this session before appending.
      const alive = existing.filter((e) => e.expiresAt > Date.now());
      alive.push({ id, surface: params.surface, memoryIds, contents, expiresAt });
      RUNTIME_INJECTION_SESSION_CACHE.set(params.sessionId, alive);
    }
    return id || null;
  } catch {
    return null;
  }
}

// Per-surface overlap threshold. jit_recall and wiki_digest are factual
// content — when the model uses them, tokens typically appear in the reply.
// working_memory is meta-state (session summaries, plan snippets) — models
// reference it by *effect* more than by citing tokens, so use a lower
// threshold to avoid a structurally-zero hit-rate.
const SCORING_OVERLAP_THRESHOLD: Record<string, number> = {
  jit_recall: 0.25,
  wiki_digest: 0.25,
  working_memory: 0.10,
};
const DEFAULT_SCORING_OVERLAP_THRESHOLD = 0.20;

async function scoreRuntimeReferenced(sessionId: string | undefined, responseText: string): Promise<void> {
  if (!sessionId) return;
  const entries = RUNTIME_INJECTION_SESSION_CACHE.get(sessionId);
  if (!entries || entries.length === 0) return;
  const responseShingles = extractShingleTokens(responseText || "");
  if (!responseShingles.size) {
    RUNTIME_INJECTION_SESSION_CACHE.delete(sessionId);
    return;
  }
  const respSha = sha(responseText || "").slice(0, 16);
  const now = Date.now();
  try {
    const db = getDb();
    await db.withClient(async (client: any) => {
      for (const entry of entries) {
        if (entry.expiresAt < now) continue;
        const threshold = SCORING_OVERLAP_THRESHOLD[entry.surface] ?? DEFAULT_SCORING_OVERLAP_THRESHOLD;
        const referenced: string[] = [];
        // Per-surface semantics:
        //  - jit_recall / wiki_digest: entry.memoryIds has the real memory ids.
        //  - working_memory: passes a synthetic id for the injected block; that
        //    entry still counts as "referenced" if the block's tokens overlap.
        for (let i = 0; i < entry.memoryIds.length; i++) {
          const ratio = contentOverlapRatio(entry.contents[i] || "", responseShingles);
          if (ratio >= threshold) referenced.push(entry.memoryIds[i]);
        }
        await client.query(
          `UPDATE brainx_runtime_injections
             SET referenced_count=$1, referenced_ids=$2, response_sha=$3, scored_at=NOW()
           WHERE id=$4 AND scored_at IS NULL`,
          [referenced.length, referenced, respSha, entry.id],
        );
      }
    });
  } catch {
    /* non-critical */
  } finally {
    RUNTIME_INJECTION_SESSION_CACHE.delete(sessionId);
  }
}

function buildWorkingMemoryOptions(config: BrainxBridgeConfig): Record<string, unknown> {
  return {
    maxChars: config.workingMemoryMaxChars,
    maxEvents: config.workingMemoryMaxEvents,
    useLlm: config.workingMemoryUseLlm,
    llmModel: config.workingMemoryLlmModel,
    llmBaseURL: config.workingMemoryLlmBaseURL,
    llmCooldownMs: config.workingMemoryLlmCooldownMs,
    llmMinTextChars: config.workingMemoryLlmMinTextChars,
  };
}

function resolveAgentIdFromRuntime(ctx: any, event?: any): string | undefined {
  return (
    (typeof ctx?.agentId === "string" && ctx.agentId.trim()) ||
    (typeof event?.context?.agentId === "string" && event.context.agentId.trim()) ||
    (typeof event?.agentId === "string" && event.agentId.trim()) ||
    extractAgentId(ctx?.sessionKey || event?.sessionKey)
  );
}

function shouldRunBridge(mode: BrainxBridgeConfig["bootstrapMode"], internalEnabled: boolean): boolean {
  if (mode === "off") return false;
  if (mode === "on") return true;
  return !internalEnabled;
}

async function readJsonFile(filePath: string): Promise<any | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function resolveWikiVaultDir(config: BrainxBridgeConfig): string {
  return normalizeWhitespace(config.wikiDigestVaultDir)
    || process.env.BRAINX_WIKI_VAULT_DIR?.trim()
    || path.join(os.homedir(), "brainx-vault");
}

function normalizeAgentKey(value: unknown): string {
  return normalizeWhitespace(value).toLowerCase();
}

type BrainxSurfaceKey =
  | "wikiDigest"
  | "jitRecall"
  | "workingMemory"
  | "toolAdvisories"
  | "captureToolFailures"
  | "bootstrap"
  | "captureOutbound";

async function ensureToolFailureMarker(key: string): Promise<boolean> {
  const dir = path.join(STATE_DIR, "brainx-plugin", "tool-failures");
  await fs.mkdir(dir, { recursive: true });
  const markerPath = path.join(dir, `${key}.json`);
  try {
    const raw = await fs.readFile(markerPath, "utf8");
    const payload = JSON.parse(raw);
    if (Date.now() - Number(payload?.createdAtMs || 0) < TOOL_FAILURE_CACHE_TTL_MS) return true;
  } catch {
    // continue
  }
  await fs.writeFile(markerPath, JSON.stringify({ createdAtMs: Date.now() }, null, 2), "utf8");
  return false;
}

async function writeFailureDailyMemory(workspaceDir: string, line: string): Promise<void> {
  const dateKey = nowIso().slice(0, 10);
  const dir = path.join(workspaceDir, "memory");
  // Tool-failure captures used to share the daily memory file (YYYY-MM-DD.md),
  // but that file is human-curated / cron-edited (Memory Daily Closeout). The
  // shared-file write caused two failure modes:
  //   1) Concurrent edits collided with the Closeout cron's Edit call, which
  //      failed on stale old_string matches and surfaced as cron errors.
  //   2) Raw command strings with embedded credentials leaked into the daily
  //      note, outside the scrubbing path that protects brainx_memories.
  // Capture lines now live in a dedicated per-day file so the daily note stays
  // clean and the write path can't race with the cron.
  const filePath = path.join(dir, `${TOOL_FAILURE_FILE_PREFIX}${dateKey}.md`);
  await fs.mkdir(dir, { recursive: true });

  let current = "";
  try {
    current = await fs.readFile(filePath, "utf8");
  } catch {
    current = `# Tool failures — ${dateKey}\n\n${TOOL_FAILURE_SECTION}\n\n`;
  }

  if (current.includes(line)) return;
  if (!current.includes(TOOL_FAILURE_SECTION)) {
    current = current.trimEnd() + `\n\n${TOOL_FAILURE_SECTION}\n\n`;
  }
  const updated = current.trimEnd() + `\n${line}\n`;
  await fs.writeFile(filePath, updated, "utf8");
}

function inferProjectHint(toolName: string, params: Record<string, unknown>): string | undefined {
  const candidate =
    (typeof params.workdir === "string" && params.workdir) ||
    (typeof params.cwd === "string" && params.cwd) ||
    (typeof params.path === "string" && params.path) ||
    (typeof params.filePath === "string" && params.filePath) ||
    "";
  if (candidate) {
    const clean = candidate.replace(/\/$/, "");
    const base = path.basename(clean);
    if (base) return base;
  }
  return toolName === "exec" ? "shell" : undefined;
}

export class BrainxBridge {
  private api: any;
  private config: BrainxBridgeConfig;
  private recallCache = new Map<string, { expiresAt: number; content: string | null }>();
  private wikiDigestCache = new Map<string, { expiresAt: number; payload: any | null }>();
  private pendingAdvisories = new Map<string, { id: string; confidence: number }>();

  constructor(api: any, config: BrainxBridgeConfig) {
    this.api = api;
    this.config = config;
  }

  private isAgentOptedIn(agentId?: string): boolean {
    if (!this.config.enforceAgentOptIn) return true;
    const key = normalizeAgentKey(agentId);
    if (!key) return false;
    return this.config.enabledAgents.includes(key);
  }

  private getSurfaceEnabledAgents(surface: BrainxSurfaceKey): string[] {
    switch (surface) {
      case "wikiDigest":
        return this.config.wikiDigestEnabledAgents;
      case "jitRecall":
        return this.config.jitRecallEnabledAgents;
      case "workingMemory":
        return this.config.workingMemoryEnabledAgents;
      case "toolAdvisories":
        return this.config.toolAdvisoriesEnabledAgents;
      case "captureToolFailures":
        return this.config.captureToolFailuresEnabledAgents;
      case "bootstrap":
        return this.config.bootstrapEnabledAgents;
      case "captureOutbound":
        return this.config.captureOutboundEnabledAgents;
      default:
        return [];
    }
  }

  private isSurfaceEnabledForAgent(surface: BrainxSurfaceKey, agentId?: string): boolean {
    const key = normalizeAgentKey(agentId);
    if (!key) return false;
    const enabledAgents = this.getSurfaceEnabledAgents(surface);
    if (enabledAgents.length > 0) {
      return enabledAgents.includes(key);
    }
    return this.isAgentOptedIn(key);
  }

  private isWorkingMemoryEnabled(agentId?: string): boolean {
    return this.config.workingMemory && this.isSurfaceEnabledForAgent("workingMemory", agentId);
  }

  private async loadWikiDigest(agentId?: string): Promise<{ promptBlock: string; source: string; generatedAt: string | null } | null> {
    if (!this.config.wikiDigest) return null;

    const vaultDir = resolveWikiVaultDir(this.config);
    const cacheKey = `${vaultDir}:${agentId || "shared"}`;
    const cached = this.wikiDigestCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const compileStatusPath = path.join(vaultDir, ".brainx-wiki", "cache", "compile-status.json");
    const compileStatus = await readJsonFile(compileStatusPath);
    if (!compileStatus?.ok) {
      this.wikiDigestCache.set(cacheKey, { expiresAt: Date.now() + 15_000, payload: null });
      return null;
    }

    const generatedAtMs = Date.parse(String(compileStatus.generatedAt || ""));
    const maxAgeMs = this.config.wikiDigestStaleHours * 60 * 60 * 1000;
    if (Number.isFinite(generatedAtMs) && Date.now() - generatedAtMs > maxAgeMs) {
      this.wikiDigestCache.set(cacheKey, { expiresAt: Date.now() + 60_000, payload: null });
      this.log("debug", `wiki digest skipped: stale compile (${relativeTimeMs(Date.now() - generatedAtMs)})`);
      return null;
    }

    const agentDigestPath = agentId
      ? path.join(vaultDir, ".brainx-wiki", "cache", "agents", `${slugifyPathSegment(agentId)}.json`)
      : null;
    const digestPath = agentDigestPath && (await readJsonFile(agentDigestPath))
      ? agentDigestPath
      : path.join(vaultDir, ".brainx-wiki", "cache", "agent-digest.json");
    const digest = await readJsonFile(digestPath);
    const promptBlock = truncate(digest?.promptBlock, this.config.wikiDigestMaxChars);

    const payload = promptBlock
      ? {
          promptBlock,
          source: digest?.agent ? "agent" : "shared",
          generatedAt: compileStatus.generatedAt || digest?.generatedAt || null,
        }
      : null;
    this.wikiDigestCache.set(cacheKey, { expiresAt: Date.now() + WIKI_DIGEST_CACHE_TTL_MS, payload });
    return payload;
  }

  async getStatusSnapshot(): Promise<Record<string, unknown>> {
    const bootstrapInternal = await isInternalHookEnabled("brainx-auto-inject");
    const liveInternal = await isInternalHookEnabled("brainx-live-capture");
    const wikiVaultDir = resolveWikiVaultDir(this.config);
    const wikiStatus = await readJsonFile(path.join(wikiVaultDir, ".brainx-wiki", "cache", "compile-status.json"));
    let workingMemoryStats: Record<string, unknown> = { fileCount: 0 };
    if (this.config.workingMemory) {
      try {
        workingMemoryStats = await getWorkingMemory().getStats();
      } catch {
        workingMemoryStats = { fileCount: 0 };
      }
    }
    return {
      enabled: this.config.enabled,
      agentOptIn: {
        enforced: this.config.enforceAgentOptIn,
        enabledAgents: this.config.enabledAgents,
        surfaceEnabledAgents: {
          wikiDigest: this.config.wikiDigestEnabledAgents,
          jitRecall: this.config.jitRecallEnabledAgents,
          workingMemory: this.config.workingMemoryEnabledAgents,
          toolAdvisories: this.config.toolAdvisoriesEnabledAgents,
          captureToolFailures: this.config.captureToolFailuresEnabledAgents,
          bootstrap: this.config.bootstrapEnabledAgents,
          captureOutbound: this.config.captureOutboundEnabledAgents,
        },
      },
      wikiDigest: {
        enabled: this.config.wikiDigest,
        maxChars: this.config.wikiDigestMaxChars,
        promptSignalsOnly: this.config.wikiDigestPromptSignalsOnly,
        staleHours: this.config.wikiDigestStaleHours,
        vaultDir: wikiVaultDir,
        compiled: Boolean(wikiStatus?.ok),
        generatedAt: wikiStatus?.generatedAt || null,
        counts: wikiStatus?.counts || null,
      },
      jitRecall: this.config.jitRecall,
      workingMemory: {
        enabled: this.config.workingMemory,
        maxChars: this.config.workingMemoryMaxChars,
        maxEvents: this.config.workingMemoryMaxEvents,
        llm: {
          enabled: this.config.workingMemoryUseLlm,
          model: this.config.workingMemoryLlmModel,
          baseURL: this.config.workingMemoryLlmBaseURL,
          cooldownMs: this.config.workingMemoryLlmCooldownMs,
        },
        stats: workingMemoryStats,
      },
      toolAdvisories: this.config.toolAdvisories,
      captureToolFailures: this.config.captureToolFailures,
      bootstrapMode: this.config.bootstrapMode,
      captureOutboundMode: this.config.captureOutboundMode,
      surfaceScopes: {
        wikiDigest: {
          enabled: this.config.wikiDigest,
          enabledAgents: this.config.wikiDigestEnabledAgents,
        },
        jitRecall: {
          enabled: this.config.jitRecall,
          enabledAgents: this.config.jitRecallEnabledAgents,
        },
        workingMemory: {
          enabled: this.config.workingMemory,
          enabledAgents: this.config.workingMemoryEnabledAgents,
        },
        toolAdvisories: {
          enabled: this.config.toolAdvisories,
          enabledAgents: this.config.toolAdvisoriesEnabledAgents,
        },
        captureToolFailures: {
          enabled: this.config.captureToolFailures,
          enabledAgents: this.config.captureToolFailuresEnabledAgents,
        },
        bootstrap: {
          mode: this.config.bootstrapMode,
          enabledAgents: this.config.bootstrapEnabledAgents,
        },
        captureOutbound: {
          mode: this.config.captureOutboundMode,
          enabledAgents: this.config.captureOutboundEnabledAgents,
        },
      },
      bootstrapBridgeActive: shouldRunBridge(this.config.bootstrapMode, bootstrapInternal),
      outboundBridgeActive: shouldRunBridge(this.config.captureOutboundMode, liveInternal),
      internalHooks: {
        autoInject: bootstrapInternal,
        liveCapture: liveInternal,
      },
      caches: {
        wikiDigestEntries: this.wikiDigestCache.size,
        recallEntries: this.recallCache.size,
        pendingAdvisories: this.pendingAdvisories.size,
      },
    };
  }

  private log(level: "debug" | "info" | "warn" | "error", message: string): void {
    const order = { debug: 10, info: 20, warn: 30, error: 40 };
    if (order[level] < order[this.config.logLevel]) return;
    const logger = this.api?.logger;
    const fn = logger?.[level] || logger?.info || console.log;
    fn.call(logger, `[brainx] ${message}`);
  }

  async logStartupSummary(): Promise<void> {
    if (!reserveStartupSummaryLog()) return;
    const bootstrapInternal = await isInternalHookEnabled("brainx-auto-inject");
    const liveInternal = await isInternalHookEnabled("brainx-live-capture");
    this.log(
      "info",
      `loaded (wikiDigest=${this.config.wikiDigest}, workingMemory=${this.config.workingMemory}, jitRecall=${this.config.jitRecall}, toolAdvisories=${this.config.toolAdvisories}, bootstrapMode=${this.config.bootstrapMode}/${bootstrapInternal ? "internal-on" : "internal-off"}, captureOutboundMode=${this.config.captureOutboundMode}/${liveInternal ? "internal-on" : "internal-off"})`,
    );
  }

  async handleBeforePromptBuild(event: any, ctx: any): Promise<{ prependContext?: string } | void> {
    const prompt = typeof event?.prompt === "string" ? event.prompt : "";
    const promptLen = normalizeWhitespace(prompt).length;
    const promptShaEarly = sha(prompt).slice(0, 16);
    const agentIdEarly = resolveAgentIdFromRuntime(ctx, event);
    const sessionIdEarly = ctx?.sessionId || ctx?.sessionKey || undefined;

    if (!this.config.wikiDigest && !this.config.jitRecall && !this.config.workingMemory) {
      void logIntakeGate({
        agent: agentIdEarly, sessionId: sessionIdEarly, promptSha: promptShaEarly,
        promptLength: promptLen, triggerFired: false, triggerReason: null,
        filterReason: "all_surfaces_disabled", isLiveMessaging: false, surfacesEnabled: "",
      });
      return;
    }
    if (promptLen < 8) {
      void logIntakeGate({
        agent: agentIdEarly, sessionId: sessionIdEarly, promptSha: promptShaEarly,
        promptLength: promptLen, triggerFired: false, triggerReason: null,
        filterReason: "prompt_too_short", isLiveMessaging: false, surfacesEnabled: "",
      });
      return;
    }
    const liveMessagingPrompt = isLiveMessagingPrompt(prompt);
    const agentId = agentIdEarly;
    const workingMemoryEnabled = this.isWorkingMemoryEnabled(agentId);
    const wikiDigestEnabled = this.config.wikiDigest && this.isSurfaceEnabledForAgent("wikiDigest", agentId);
    const jitRecallEnabled = this.config.jitRecall && this.isSurfaceEnabledForAgent("jitRecall", agentId);
    const surfacesEnabled = [
      workingMemoryEnabled ? "wm" : null,
      wikiDigestEnabled ? "wiki" : null,
      jitRecallEnabled ? "jit" : null,
    ].filter(Boolean).join(",");
    if (!workingMemoryEnabled && !wikiDigestEnabled && !jitRecallEnabled) {
      void logIntakeGate({
        agent: agentIdEarly, sessionId: sessionIdEarly, promptSha: promptShaEarly,
        promptLength: promptLen, triggerFired: false, triggerReason: null,
        filterReason: "no_surfaces_enabled_for_agent", isLiveMessaging: liveMessagingPrompt,
        surfacesEnabled: "",
      });
      return;
    }

    // Silent-by-default: working memory ALWAYS observes prompt (state tracking is
    // cheap and off-prompt), but injection only fires when the prompt shows an
    // explicit request or domain signal. This keeps prompts clean on small talk.
    if (workingMemoryEnabled) {
      try {
        const workingMemory = getWorkingMemory();
        await workingMemory.observePrompt(
          { agentId, sessionKey: ctx?.sessionKey, sessionId: ctx?.sessionId },
          prompt,
          buildWorkingMemoryOptions(this.config),
        );
      } catch (error: any) {
        this.log("debug", `working memory observe skipped: ${error?.message || String(error)}`);
      }
    }

    const trigger = shouldTriggerInjection(prompt);
    if (!trigger.fire) {
      this.log("debug", `injection skipped (trigger=${trigger.reason}) agent=${agentId || "unknown"}`);
      void logIntakeGate({
        agent: agentIdEarly, sessionId: sessionIdEarly, promptSha: promptShaEarly,
        promptLength: promptLen, triggerFired: false, triggerReason: trigger.reason,
        filterReason: `trigger:${trigger.reason}`, isLiveMessaging: liveMessagingPrompt,
        surfacesEnabled,
      });
      return;
    }
    void logIntakeGate({
      agent: agentIdEarly, sessionId: sessionIdEarly, promptSha: promptShaEarly,
      promptLength: promptLen, triggerFired: true, triggerReason: trigger.reason,
      filterReason: null, isLiveMessaging: liveMessagingPrompt,
      surfacesEnabled,
    });

    // Explicit user request ("recordá", "qué sabemos", "brainx", "memoria")
    // is an escape hatch: relax recall thresholds so the user reliably gets
    // memories surfaced when they ask for them.
    const explicitRecall = trigger.reason === "explicit";
    // Explicit-recall cap lowered 2026-04-19 from 0.5 → 0.40 to preserve the
    // gap vs. the new general default (0.45). Without this, both modes
    // collapse to ~0.45 and "explicit" stops being more permissive.
    const recallMinSimilarity = explicitRecall
      ? Math.min(this.config.recallMinSimilarity, 0.40)
      : this.config.recallMinSimilarity;
    const recallMinImportance = explicitRecall
      ? Math.min(this.config.recallMinImportance ?? 5, 5)
      : this.config.recallMinImportance;
    const recallLimit = explicitRecall
      ? Math.max(this.config.recallLimit, 3)
      : this.config.recallLimit;
    const signalGateForTurn = explicitRecall
      ? null
      : (this.config.signalGateEnabled
          ? {
              minImportance: this.config.signalGateMinImportance,
              minSimilarity: this.config.signalGateMinSimilarity,
              staleDays: this.config.signalGateStaleDays,
            }
          : null);

    const turnKey = makeTurnKey(ctx, prompt);

    // Priority order (one surface per turn): jit_recall > working_memory > wiki_digest.
    // jit_recall is the most specific (semantic search tied to the prompt),
    // working_memory carries session continuity, wiki_digest is the broadest.
    let recallBlock: string | null = null;
    if (jitRecallEnabled) {
      const query = buildPromptQuery(prompt);
      const allowHistoricalChangelog = isHistoricalPrompt(prompt);
      const troubleshootingPrompt = isTroubleshootingPrompt(prompt);
      const promptTerms = extractPromptTerms(prompt);
      const cacheKey = sha(`${ctx?.agentId || "unknown"}:${allowHistoricalChangelog ? "historical" : "default"}:${troubleshootingPrompt ? "troubleshoot" : "general"}:${explicitRecall ? "explicit" : "signaled"}:${query}`);
      const cached = this.recallCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        recallBlock = cached.content;
      } else {
        const recallStartedAt = Date.now();
        try {
          const rag = getRag();
          const rawResults = await rag.search(query, {
            limit: Math.max(recallLimit * 3, 6),
            minImportance: recallMinImportance,
            minSimilarity: recallMinSimilarity,
          });

          const filtered = await filterRecallRows(rawResults, ctx?.agentId, promptTerms, recallMinSimilarity, {
            allowHistoricalChangelog,
            troubleshootingPrompt,
            allowCrossAgent: this.config.jitRecallAllowCrossAgent,
            crossAgentTagRequired: this.config.jitRecallCrossAgentTagRequired,
            crossAgentRequireVerified: this.config.jitRecallCrossAgentRequireVerified,
            signalGate: signalGateForTurn,
          });
          const afterDedup = this.config.antiDupPromptEnabled
            ? (() => {
                const promptShingles = extractShingleTokens(prompt);
                return filtered.filter((row) => contentOverlapRatio(String(row?.content || ""), promptShingles) < this.config.antiDupPromptMinOverlap);
              })()
            : filtered;
          // Drop rows already present in MEMORY.md (bootstrap injection): the
          // agent already sees them, re-injecting wastes tokens.
          const memoryMdFingerprints = await loadMemoryMdFingerprints(ctx?.agentId);
          const afterMemoryMd = memoryMdFingerprints.size > 0
            ? afterDedup.filter((row) => {
                const fp = fingerprintMemoryContent(row?.content);
                return !fp || !memoryMdFingerprints.has(fp);
              })
            : afterDedup;
          const memoryMdDropped = Math.max(0, afterDedup.length - afterMemoryMd.length);
          const selected = selectRecallRows(afterMemoryMd, ctx?.agentId, recallLimit, this.config.signalGateRecencyDecayDays);
          recallBlock = formatRecallBlock(selected, this.config.recallMaxChars, { troubleshootingPrompt });
          this.recallCache.set(cacheKey, { expiresAt: Date.now() + RECALL_CACHE_TTL_MS, content: recallBlock });
          if (recallBlock) {
            this.log(
              "debug",
              `jit recall built ${selected.length} memories (trigger=${trigger.reason}) agent=${ctx?.agentId || "unknown"} mode=${allowHistoricalChangelog ? "historical" : "default"} prompt=${troubleshootingPrompt ? "troubleshoot" : "general"} memory_md_dropped=${memoryMdDropped}`,
            );
          }
          const nearDupDropped = Math.max(0, filtered.length - afterDedup.length) + memoryMdDropped;
          const signalGateDropped = Math.max(0, rawResults.length - filtered.length);
          void logRuntimeInjection({
            agent: ctx?.agentId,
            sessionId: ctx?.sessionId || ctx?.sessionKey,
            surface: "jit_recall",
            rawCount: rawResults.length,
            filteredCount: filtered.length,
            selectedCount: selected.length,
            nearDupDropped,
            signalGateDropped,
            selectedRows: selected,
            promptSha: sha(prompt).slice(0, 16),
            promptPreview: prompt,
            latencyMs: Date.now() - recallStartedAt,
          });
        } catch (error: any) {
          this.recallCache.set(cacheKey, { expiresAt: Date.now() + 15_000, content: null });
          this.log("warn", `jit recall failed: ${error?.message || String(error)}`);
        }
      }
    }
    if (recallBlock && !reserveTurnBudget(turnKey, "jit_recall", recallBlock.length)) {
      recallBlock = null;
    }

    let workingMemoryBlock: string | null = null;
    if (workingMemoryEnabled && !liveMessagingPrompt && !recallBlock) {
      const wmStartedAt = Date.now();
      let rawBuilt: string | null = null;
      let relevanceDropped = 0;
      try {
        const workingMemory = getWorkingMemory();
        rawBuilt = await workingMemory.buildPromptBlock(
          { agentId, sessionKey: ctx?.sessionKey, sessionId: ctx?.sessionId },
          buildWorkingMemoryOptions(this.config),
        );
        workingMemoryBlock = rawBuilt;
      } catch (error: any) {
        this.log("warn", `working memory build failed: ${error?.message || String(error)}`);
      }
      // RELEVANCE_GATE_20260420: drop continuity blocks that share effectively
      // nothing with the current prompt. This is the analog of jit_recall's
      // antiDup gate for working_memory — without it the block flies through
      // unfiltered and is the main noise vector when state.activeProject is
      // stale or cross-topic. Threshold is intentionally low (default 0.05)
      // to preserve genuine session continuity while filtering ajeno.
      if (workingMemoryBlock && this.config.workingMemoryMinRelevance > 0) {
        const promptShingles = extractShingleTokens(prompt);
        const ratio = contentOverlapRatio(workingMemoryBlock, promptShingles);
        if (ratio < this.config.workingMemoryMinRelevance) {
          this.log(
            "debug",
            `working memory dropped by relevance gate: ratio=${ratio.toFixed(3)} < ${this.config.workingMemoryMinRelevance} agent=${agentId || "unknown"}`,
          );
          workingMemoryBlock = null;
          relevanceDropped = 1;
        }
      }
      if (workingMemoryBlock && !reserveTurnBudget(turnKey, "working_memory", workingMemoryBlock.length)) {
        workingMemoryBlock = null;
      }
      void logRuntimeInjection({
        agent: ctx?.agentId,
        sessionId: ctx?.sessionId || ctx?.sessionKey,
        surface: "working_memory",
        rawCount: rawBuilt ? 1 : 0,
        filteredCount: workingMemoryBlock ? 1 : 0,
        selectedCount: workingMemoryBlock ? 1 : 0,
        nearDupDropped: 0,
        signalGateDropped: relevanceDropped,
        // Synthetic "row" so scoreRuntimeReferenced has content to match against.
        // Without this, working_memory was structurally stuck at 0% hit-rate.
        selectedRows: workingMemoryBlock
          ? [{ id: `wm_${sha(prompt).slice(0, 12)}`, content: workingMemoryBlock, similarity: 1, importance: 5 }]
          : [],
        promptSha: sha(prompt).slice(0, 16),
        promptPreview: prompt,
        latencyMs: Date.now() - wmStartedAt,
      });
    }

    let wikiDigestBlock: string | null = null;
    if (wikiDigestEnabled && !recallBlock && !workingMemoryBlock && shouldInjectWikiDigest(prompt, this.config)) {
      const wikiStartedAt = Date.now();
      let rawBuilt: string | null = null;
      let relevanceDropped = 0;
      try {
        const digest = await this.loadWikiDigest(agentId);
        rawBuilt = digest?.promptBlock || null;
        wikiDigestBlock = rawBuilt;
        if (wikiDigestBlock) {
          this.log("debug", `wiki digest built (${digest?.source || "shared"}) agent=${agentId || "unknown"}`);
        }
      } catch (error: any) {
        this.log("warn", `wiki digest failed: ${error?.message || String(error)}`);
      }
      // RELEVANCE_GATE_20260420: same gate as working_memory — a compiled wiki
      // digest with zero token overlap vs the current prompt is noise.
      if (wikiDigestBlock && this.config.wikiDigestMinRelevance > 0) {
        const promptShingles = extractShingleTokens(prompt);
        const ratio = contentOverlapRatio(wikiDigestBlock, promptShingles);
        if (ratio < this.config.wikiDigestMinRelevance) {
          this.log(
            "debug",
            `wiki digest dropped by relevance gate: ratio=${ratio.toFixed(3)} < ${this.config.wikiDigestMinRelevance} agent=${agentId || "unknown"}`,
          );
          wikiDigestBlock = null;
          relevanceDropped = 1;
        }
      }
      if (wikiDigestBlock && !reserveTurnBudget(turnKey, "wiki_digest", wikiDigestBlock.length)) {
        wikiDigestBlock = null;
      }
      void logRuntimeInjection({
        agent: ctx?.agentId,
        sessionId: ctx?.sessionId || ctx?.sessionKey,
        surface: "wiki_digest",
        rawCount: rawBuilt ? 1 : 0,
        filteredCount: wikiDigestBlock ? 1 : 0,
        selectedCount: wikiDigestBlock ? 1 : 0,
        nearDupDropped: 0,
        signalGateDropped: relevanceDropped,
        // Synthetic "row" so scoreRuntimeReferenced has content to match against.
        selectedRows: wikiDigestBlock
          ? [{ id: `wiki_${sha(prompt).slice(0, 12)}`, content: wikiDigestBlock, similarity: 1, importance: 5 }]
          : [],
        promptSha: sha(prompt).slice(0, 16),
        promptPreview: prompt,
        latencyMs: Date.now() - wikiStartedAt,
      });
    }

    const combined = [recallBlock, workingMemoryBlock, wikiDigestBlock].filter((value): value is string => Boolean(value)).join("\n\n");
    if (!combined) return;
    return { prependContext: combined };
  }

  async handleBeforeToolCall(event: any, ctx: any): Promise<any> {
    const toolName = String(event?.toolName || ctx?.toolName || "").trim();
    if (!toolName) return;

    const agentId = resolveAgentIdFromRuntime(ctx, event);
    const workingMemoryEnabled = this.isWorkingMemoryEnabled(agentId);
    const toolAdvisoriesEnabled = this.config.toolAdvisories && this.isSurfaceEnabledForAgent("toolAdvisories", agentId);
    if (!workingMemoryEnabled && !toolAdvisoriesEnabled) return;
    if (workingMemoryEnabled) {
      try {
        await getWorkingMemory().observeToolStart(
          { agentId, sessionKey: ctx?.sessionKey, sessionId: ctx?.sessionId },
          toolName,
          asObject(event?.params),
          buildWorkingMemoryOptions(this.config),
        );
      } catch (error: any) {
        this.log("debug", `working memory tool-start skipped: ${error?.message || String(error)}`);
      }
    }

    if (!toolAdvisoriesEnabled) return;

    // Silent-by-default: advisory only runs for a closed set of risky tools.
    // Anything outside the whitelist never touches BrainX.
    if (!isAdvisoryToolAllowed(toolName)) return;

    let advisoryLib: any;
    try {
      advisoryLib = getAdvisory();
    } catch (error: any) {
      this.log("warn", `advisory module unavailable: ${error?.message || String(error)}`);
      return;
    }

    const isHighRisk = advisoryLib?.isHighRisk?.(toolName) || HIGH_RISK_FALLBACK_TOOLS.has(toolName.toLowerCase());
    if (!isHighRisk) return;

    try {
      const result = await advisoryLib.getAdvisory({
        tool: toolName,
        args: asObject(event?.params),
        agent: ctx?.agentId,
        project: inferProjectHint(toolName, asObject(event?.params)),
      });
      if (!result?.id || !result?.advisory_text || result?.on_cooldown) return;

      this.pendingAdvisories.set(pendingKey(ctx, event), {
        id: result.id,
        confidence: Number(result.confidence || 0),
      });

      if (this.config.advisoryRequireApproval && Number(result.confidence || 0) >= this.config.advisoryApprovalThreshold) {
        return {
          requireApproval: {
            title: `BrainX advisory for ${toolName}`,
            description: truncate(result.advisory_text, this.config.advisoryMaxChars),
            severity: Number(result.confidence || 0) >= 0.92 ? "critical" : "warning",
            timeoutMs: 120000,
            timeoutBehavior: "deny",
          },
        };
      }
    } catch (error: any) {
      this.log("warn", `advisory lookup failed for ${toolName}: ${error?.message || String(error)}`);
    }
    return;
  }

  async handleAfterToolCall(event: any, ctx: any): Promise<void> {
    const agentId = resolveAgentIdFromRuntime(ctx, event);
    const workingMemoryEnabled = this.isWorkingMemoryEnabled(agentId);
    const captureToolFailuresEnabled = this.config.captureToolFailures && this.isSurfaceEnabledForAgent("captureToolFailures", agentId);
    const toolAdvisoriesEnabled = this.config.toolAdvisories && this.isSurfaceEnabledForAgent("toolAdvisories", agentId);
    if (!workingMemoryEnabled && !captureToolFailuresEnabled && !toolAdvisoriesEnabled) return;
    if (workingMemoryEnabled) {
      try {
        await getWorkingMemory().observeToolResult(
          { agentId, sessionKey: ctx?.sessionKey, sessionId: ctx?.sessionId },
          String(event?.toolName || ctx?.toolName || ""),
          asObject(event?.params),
          event?.result,
          event?.error,
          buildWorkingMemoryOptions(this.config),
        );
      } catch (error: any) {
        this.log("debug", `working memory tool-result skipped: ${error?.message || String(error)}`);
      }
    }

    const key = pendingKey(ctx, event);
    const pending = this.pendingAdvisories.get(key);
    if (pending) {
      this.pendingAdvisories.delete(key);
      try {
        const advisoryLib = getAdvisory();
        await advisoryLib.advisoryFeedback(
          pending.id,
          null,
          event?.error ? `tool_failed:${truncate(event.error, 180)}` : `tool_success:${event?.durationMs || 0}ms`,
        );
      } catch (error: any) {
        this.log("debug", `advisory feedback skipped: ${error?.message || String(error)}`);
      }
    }

    if (!captureToolFailuresEnabled) return;
    const toolName = String(event?.toolName || ctx?.toolName || "");
    const failureInfo = extractToolFailureInfo(event);
    if (!failureInfo.isFailure || !failureInfo.errorText) return;
    const errorText = failureInfo.errorText;
    if (!shouldCaptureFailure(toolName, errorText)) return;

    const failureAgentId = agentId || "unknown";
    const params = asObject(event?.params);
    const signature = sha(`${failureAgentId}|${toolName}|${errorText}|${JSON.stringify(params)}`).slice(0, 16);
    if (await ensureToolFailureMarker(signature)) return;

    const rawSummary = truncate(
      `${toolName} failed. ${summarizeToolParams(params)}. Error: ${errorText}`,
      500,
    );
    const summary = scrubSecretsForFailureLog(rawSummary);

    const workspaceDir = await resolveWorkspaceDir(failureAgentId);
    const timestamp = nowIso();
    const dailyLine = `- [brainx-tool-failure:${signature}] ${timestamp} | agent=${failureAgentId} | tool=${toolName} | ${summary}`;

    if (workspaceDir && this.config.writeFailuresToDailyMemory) {
      try {
        await writeFailureDailyMemory(workspaceDir, dailyLine);
      } catch (error: any) {
        this.log("warn", `daily tool-failure write failed: ${error?.message || String(error)}`);
      }
    }

    if (this.config.writeFailuresToBrainx) {
      try {
        const rag = getRag();
        const patternKey = buildToolFailurePatternKey(toolName, errorText);
        await rag.storeMemory({
          id: `m_toolfail_${Date.now()}_${signature}`,
          type: "gotcha",
          content: summary,
          context: `agent:${failureAgentId}`,
          tier: toolName === "exec" ? "hot" : "warm",
          importance: toolName === "exec" ? 8 : 7,
          agent: failureAgentId,
          tags: ["brainx-plugin", "tool-failure", `tool:${toolName}`],
          category: toolName === "exec" ? "infrastructure" : "error",
          patternKey,
          status: "in_progress",
          sourceKind: "tool_verified",
          sourcePath: [
            `session:${ctx?.sessionKey || "unknown"}`,
            `tool:${toolName}`,
            `toolCall:${ctx?.toolCallId || event?.toolCallId || "unknown"}`,
          ].join("|"),
          confidence: 0.84,
          verificationState: "changelog",
        });
      } catch (error: any) {
        this.log("warn", `brainx tool-failure capture failed: ${error?.message || String(error)}`);
      }
    }
  }

  async handleAgentBootstrap(event: any): Promise<void> {
    const internalEnabled = await isInternalHookEnabled("brainx-auto-inject");
    if (!shouldRunBridge(this.config.bootstrapMode, internalEnabled)) return;
    if (!this.isSurfaceEnabledForAgent("bootstrap", event?.context?.agentId || extractAgentId(event?.sessionKey))) return;
    try {
      const handler = await getAutoInjectHook();
      await handler(event);
      this.log("debug", `bootstrap bridge ran for agent=${event?.context?.agentId || extractAgentId(event?.sessionKey) || "unknown"}`);
    } catch (error: any) {
      this.log("warn", `bootstrap bridge failed: ${error?.message || String(error)}`);
    }
  }

  async handleMessageSent(event: any): Promise<void> {
    const internalEnabled = await isInternalHookEnabled("brainx-live-capture");
    if (!shouldRunBridge(this.config.captureOutboundMode, internalEnabled)) return;
    if (!this.isSurfaceEnabledForAgent("captureOutbound", event?.context?.agentId || extractAgentId(event?.sessionKey) || event?.agentId)) return;
    try {
      const handler = await getLiveCaptureHook();
      await handler(event);
      this.log("debug", `outbound capture bridge ran in ${relativeTimeMs(0)}`);
    } catch (error: any) {
      this.log("warn", `outbound capture bridge failed: ${error?.message || String(error)}`);
    }
  }

  async handleLlmOutput(event: any, ctx: any): Promise<void> {
    const agentId = resolveAgentIdFromRuntime(ctx, event);
    const assistantTexts = Array.isArray(event?.assistantTexts)
      ? event.assistantTexts.map((part: unknown) => normalizeWhitespace(part)).filter(Boolean)
      : [];
    const combined = assistantTexts.join("\n\n");
    if (!combined) return;

    void scoreRuntimeReferenced(ctx?.sessionId || ctx?.sessionKey, combined).catch(() => {});

    if (!this.isWorkingMemoryEnabled(agentId)) return;
    void getWorkingMemory()
      .observeAssistantOutput(
        { agentId, sessionKey: ctx?.sessionKey, sessionId: ctx?.sessionId },
        combined,
        buildWorkingMemoryOptions(this.config),
      )
      .catch((error: any) => {
        this.log("debug", `working memory llm-output skipped: ${error?.message || String(error)}`);
      });
  }

  async handleSessionStart(event: any, ctx: any): Promise<void> {
    const agentId = resolveAgentIdFromRuntime(ctx, event);
    if (!this.isWorkingMemoryEnabled(agentId)) return;
    try {
      await getWorkingMemory().prepareSession(
        { agentId, sessionKey: event?.sessionKey || ctx?.sessionKey, sessionId: event?.sessionId || ctx?.sessionId },
        buildWorkingMemoryOptions(this.config),
      );
    } catch (error: any) {
      this.log("debug", `working memory session-start skipped: ${error?.message || String(error)}`);
    }
  }

  async handleSessionEnd(event: any, ctx: any): Promise<void> {
    const agentId = resolveAgentIdFromRuntime(ctx, event);
    if (!this.isWorkingMemoryEnabled(agentId)) return;
    try {
      await getWorkingMemory().closeSession(
        { agentId, sessionKey: event?.sessionKey || ctx?.sessionKey, sessionId: event?.sessionId || ctx?.sessionId },
        buildWorkingMemoryOptions(this.config),
      );
    } catch (error: any) {
      this.log("debug", `working memory session-end skipped: ${error?.message || String(error)}`);
    }
  }
}

// Internal helpers exposed only for unit tests. Do not use in production code.
export const __testInternals = {
  isCrossAgentRowAllowed,
  shouldTriggerInjection,
  buildPromptQuery,
  extractPromptTerms,
  shouldRecallRow,
  filterRecallRows,
  passesSignalGate,
  computeSignalScore,
  rowAgeDays,
  extractShingleTokens,
  contentOverlapRatio,
};
