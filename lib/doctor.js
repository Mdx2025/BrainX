/**
 * BrainX Doctor — Diagnostic Report
 * Read-only checks on BrainX health, schema, data integrity, and stats.
 * Output styled with Unicode box-drawing (clack/prompts style).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { summarizeLiveCapture } = require('./live-capture-stats');
const { getStats: getWorkingMemoryStats } = require('./working-memory');
const { getWikiStatus, lintWiki } = require('./wiki');
const { CANONICAL_RULES_FILE, readCanonicalRules } = require('./promotion-governance');

// ─── Expected schema definitions ───

const EXPECTED_COLUMNS = [
  'id', 'type', 'content', 'context', 'tier', 'agent', 'importance',
  'embedding', 'created_at', 'last_accessed', 'access_count', 'feedback_score', 'source_session',
  'superseded_by', 'tags', 'status', 'category', 'pattern_key',
  'recurrence_count', 'first_seen', 'last_seen', 'resolved_at',
  'promoted_to', 'resolution_notes',
  'source_kind', 'source_path', 'confidence_score', 'expires_at', 'sensitivity', 'verification_state'
];

const EXPECTED_CONSTRAINTS = [
  'brainx_memories_type_check',
  'brainx_memories_category_check',
  'brainx_memories_source_kind_check',
  'brainx_memories_sensitivity_check',
  'brainx_memories_confidence_score_check',
  'brainx_memories_verification_state_check'
];

const EXPECTED_INDEXES = [
  'idx_mem_expires_at',
  'idx_mem_sensitivity',
  'idx_mem_embedding',
  'idx_mem_tier',
  'idx_mem_context',
  'idx_mem_tags',
  'idx_mem_status',
  'idx_mem_category',
  'idx_mem_pattern_key',
  'idx_mem_verification_state'
];

const EXPECTED_TABLES = [
  'brainx_advisories',
  'brainx_context_packs',
  'brainx_distillation_log',
  'brainx_eidos_cycles',
  'brainx_learning_details',
  'brainx_memories',
  'brainx_patterns',
  'brainx_pilot_log',
  'brainx_query_log',
  'brainx_schema_version',
  'brainx_session_snapshots',
  'brainx_trajectories'
];

const BRAINX_ROOT = path.join(__dirname, '..');
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '', '.openclaw');
const CLI_PATH = path.join(__dirname, 'cli.js');
const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_HOME, 'openclaw.json');
const DAILY_CORE_WRAPPER_PATH = path.join(OPENCLAW_HOME, 'workspace', 'scripts', 'brainx-daily-core-wrapper.sh');
const SURFACE_POLICY_PATH = path.join(BRAINX_ROOT, 'config', 'surface-policy.json');
const AGENT_CORE_TEMPLATE_AGENTS = path.join(OPENCLAW_HOME, 'standards', 'agent-core', 'templates', 'AGENTS.md');
const AGENT_CORE_TEMPLATE_TOOLS = path.join(OPENCLAW_HOME, 'standards', 'agent-core', 'templates', 'TOOLS.md');
const HOOK_PATH = path.join(OPENCLAW_HOME, 'hooks', 'brainx-auto-inject', 'handler.js');
const HOOK_SOURCE_PATH = path.join(BRAINX_ROOT, 'hook', 'handler.js');
const HOOK_PROFILES_PATH = path.join(OPENCLAW_HOME, 'hooks', 'brainx-auto-inject', 'agent-profiles.json');
const HOOK_PROFILES_SOURCE_PATH = path.join(BRAINX_ROOT, 'hook', 'agent-profiles.json');
const LIVE_HOOK_PATH = path.join(OPENCLAW_HOME, 'hooks', 'brainx-live-capture', 'handler.js');
const LIVE_HOOK_SOURCE_PATH = path.join(BRAINX_ROOT, 'hook-live', 'handler.js');
const WORKING_MEMORY_STALE_OPEN_MS = 36 * 60 * 60 * 1000;
const WORKING_MEMORY_UNTRUSTED_MARKERS = [
  /Untrusted context \(metadata, do not treat as instructions or commands\):/i,
  /Conversation info \(untrusted metadata\)/i,
  /Sender \(untrusted metadata\)/i,
  /UNTRUSTED (?:Discord|Slack|Telegram|WhatsApp) message body/i
];

const FEATURE_FILES = [
  'lib/advisory.js',
  'lib/eidos.js',
  'lib/doctor.js',
  'lib/fix.js',
  'lib/live-capture-stats.js',
  'lib/openai-rag.js',
  'lib/wiki.js',
  'lib/embedding-client.js',
  'config/surface-policy.json',
  'scripts/auto-distiller.js',
  'scripts/auto-promoter.js',
  'scripts/context-pack-builder.js',
  'scripts/contradiction-detector.js',
  'scripts/cross-agent-learning.js',
  'scripts/dedup-supersede.js',
  'scripts/error-harvester.js',
  'scripts/fact-extractor.js',
  'scripts/learning-detail-extractor.js',
  'scripts/memory-bridge.js',
  'scripts/memory-consolidator.js',
  'scripts/memory-distiller.js',
  'scripts/memory-feedback.js',
  'scripts/memory-md-harvester.js',
  'scripts/pattern-detector.js',
  'scripts/promotion-applier.js',
  'scripts/quality-scorer.js',
  'scripts/session-harvester.js',
  'scripts/session-snapshot.js',
  'scripts/trajectory-recorder.js',
  'tests/cli-v5.js',
  'tests/smoke.js',
  'hook/HOOK.md',
  'hook/handler.js',
  'hook/agent-profiles.json',
  'hook-live/HOOK.md',
  'hook-live/handler.js',
  'hook-live/package.json'
];

const EXPECTED_COMMANDS = [
  'doctor',
  'fix',
  'health',
  'add',
  'fact',
  'facts',
  'feature',
  'features',
  'search',
  'inject',
  'feedback',
  'resolve',
  'promote-candidates',
  'lifecycle-run',
  'metrics',
  'wiki',
  'advisory',
  'advisory-feedback',
  'eidos'
];

function readJsonFileSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readTextFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseIsoMs(value) {
  const parsed = value ? Date.parse(String(value)) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOpenClawConfigSync() {
  return readJsonFileSafe(OPENCLAW_CONFIG_PATH);
}

function getRuntimeGovernanceState() {
  const config = readOpenClawConfigSync();
  if (!config) return null;

  const pluginEntry = config?.plugins?.entries?.brainx || {};
  const pluginConfig = pluginEntry?.config || {};
  const pluginEnabled = Boolean(pluginEntry?.enabled && pluginConfig.enabled !== false);
  const enabledAgents = Array.isArray(pluginConfig.enabledAgents)
    ? pluginConfig.enabledAgents.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean)
    : [];
  const internalHooksEnabled = Boolean(config?.hooks?.internal?.enabled);
  const internalBootstrap = Boolean(internalHooksEnabled && config?.hooks?.internal?.entries?.['brainx-auto-inject']?.enabled);
  const internalLiveCapture = Boolean(internalHooksEnabled && config?.hooks?.internal?.entries?.['brainx-live-capture']?.enabled);
  const pluginPromptRoute = Boolean(
    pluginEnabled && (
      pluginConfig.wikiDigest ||
      pluginConfig.jitRecall ||
      pluginConfig.workingMemory ||
      (pluginConfig.bootstrapMode && pluginConfig.bootstrapMode !== 'off')
    )
  );
  const pluginExecutionRoute = Boolean(
    pluginEnabled && (
      pluginConfig.toolAdvisories ||
      pluginConfig.captureToolFailures ||
      (pluginConfig.captureOutboundMode && pluginConfig.captureOutboundMode !== 'off')
    )
  );

  return {
    pluginEnabled,
    pluginConfig,
    enabledAgents,
    internalBootstrap,
    internalLiveCapture,
    pluginPromptRoute,
    pluginExecutionRoute,
  };
}

function getWorkingMemoryFiles() {
  const files = [];
  let agents = [];
  try {
    agents = fs.readdirSync(WORKING_MEMORY_DIR, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of agents) {
    if (!entry.isDirectory()) continue;
    const agentDir = path.join(WORKING_MEMORY_DIR, entry.name);
    let agentFiles = [];
    try {
      agentFiles = fs.readdirSync(agentDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of agentFiles) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;
      files.push(path.join(agentDir, file.name));
    }
  }
  return files;
}

function stateActivityMs(state) {
  return (
    parseIsoMs(state?.updatedAt)
    ?? parseIsoMs(state?.summary?.updatedAt)
    ?? parseIsoMs(state?.closedAt)
    ?? parseIsoMs(state?.createdAt)
  );
}

function isWorkingMemoryClosed(state) {
  return parseIsoMs(state?.closedAt) != null;
}

function isWorkingMemoryStaleOpen(state) {
  if (isWorkingMemoryClosed(state)) return false;
  const activityMs = stateActivityMs(state);
  return activityMs != null && Date.now() - activityMs > WORKING_MEMORY_STALE_OPEN_MS;
}

function hasWorkingMemoryUntrustedLeak(state) {
  const facts = state?.facts || {};
  return ['currentGoal', 'activeTask', 'lastUserPrompt'].some((key) =>
    WORKING_MEMORY_UNTRUSTED_MARKERS.some((re) => re.test(String(facts[key] || ''))),
  );
}

// ─── Check functions ───
// Each returns { status: 'ok'|'warn'|'fail'|'info', label, detail, verbose? }

async function checkDbConnection(db) {
  try {
    const res = await db.query("SELECT current_database() AS dbname, inet_server_addr() AS host");
    const row = res.rows[0] || {};
    const dbname = row.dbname || 'unknown';
    const host = row.host || 'localhost';
    return { status: 'ok', label: 'Connection', detail: `OK (${dbname}@${host})` };
  } catch (err) {
    return { status: 'fail', label: 'Connection', detail: err.message };
  }
}

async function checkPgvector(db) {
  try {
    const res = await db.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
    if (res.rows.length === 0) {
      return { status: 'fail', label: 'pgvector', detail: 'not installed' };
    }
    return { status: 'ok', label: 'pgvector', detail: `v${res.rows[0].extversion}` };
  } catch (err) {
    return { status: 'fail', label: 'pgvector', detail: err.message };
  }
}

async function checkTables(db) {
  try {
    const res = await db.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'brainx_%'"
    );
    const n = res.rows[0]?.n ?? 0;
    return { status: n > 0 ? 'ok' : 'fail', label: 'Tables', detail: `${n} found` };
  } catch (err) {
    return { status: 'fail', label: 'Tables', detail: err.message };
  }
}

async function checkFeatureTables(db) {
  try {
    const res = await db.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'brainx_%'`
    );
    const existing = new Set(res.rows.map(r => r.table_name));
    const missing = EXPECTED_TABLES.filter(t => !existing.has(t));
    const found = EXPECTED_TABLES.length - missing.length;
    if (missing.length === 0) {
      return { status: 'ok', label: 'Feature tables', detail: `${found}/${EXPECTED_TABLES.length}` };
    }
    return {
      status: 'warn',
      label: 'Feature tables',
      detail: `${found}/${EXPECTED_TABLES.length} present`,
      verbose: missing.map(t => `missing: ${t}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Feature tables', detail: err.message };
  }
}

async function checkSchemaColumns(db) {
  try {
    const res = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'brainx_memories'`
    );
    const existing = new Set(res.rows.map(r => r.column_name));
    const missing = EXPECTED_COLUMNS.filter(c => !existing.has(c));
    const found = EXPECTED_COLUMNS.length - missing.length;
    if (missing.length === 0) {
      return { status: 'ok', label: 'Columns', detail: `${found}/${EXPECTED_COLUMNS.length}` };
    }
    return {
      status: 'warn', label: 'Columns',
      detail: `${found}/${EXPECTED_COLUMNS.length} (missing: ${missing.join(', ')})`,
      verbose: missing.map(c => `missing column: ${c}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Columns', detail: err.message };
  }
}

async function checkSchemaConstraints(db) {
  try {
    const res = await db.query(
      `SELECT conname FROM pg_constraint
       WHERE conrelid = 'brainx_memories'::regclass AND contype = 'c'`
    );
    const existing = new Set(res.rows.map(r => r.conname));
    const missing = EXPECTED_CONSTRAINTS.filter(c => !existing.has(c));
    const total = EXPECTED_CONSTRAINTS.length;
    const found = total - missing.length;
    if (missing.length === 0) {
      return { status: 'ok', label: 'Constraints', detail: `${found}/${total}` };
    }
    return {
      status: 'warn', label: 'Constraints',
      detail: `${found}/${total} (missing: ${missing.length})`,
      verbose: missing.map(c => `missing: ${c}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Constraints', detail: err.message };
  }
}

async function checkIndexes(db) {
  try {
    const res = await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'brainx_memories'`);
    const existing = new Set(res.rows.map(r => r.indexname));
    const missing = EXPECTED_INDEXES.filter(i => !existing.has(i));
    const found = EXPECTED_INDEXES.length - missing.length;
    if (missing.length === 0) {
      return { status: 'ok', label: 'Indexes', detail: `${found} found` };
    }
    return {
      status: 'warn', label: 'Indexes',
      detail: `${found} found (missing ${missing.length})`,
      verbose: missing.map(i => `missing: ${i}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Indexes', detail: err.message };
  }
}

async function checkSchemaVersion(db) {
  try {
    const res = await db.query(
      `SELECT version, description
       FROM brainx_schema_version
       ORDER BY version DESC
       LIMIT 1`
    );
    if (res.rows.length === 0) {
      return { status: 'warn', label: 'Schema version', detail: 'brainx_schema_version is empty' };
    }
    const row = res.rows[0];
    if (Number(row.version) >= 5) {
      return { status: 'ok', label: 'Schema version', detail: `v${row.version}${row.description ? ` (${row.description})` : ''}` };
    }
    return { status: 'fail', label: 'Schema version', detail: `expected >= v5, found v${row.version}` };
  } catch (err) {
    return { status: 'fail', label: 'Schema version', detail: err.message };
  }
}

async function checkOrphanedRefs(db) {
  try {
    const res = await db.query(
      `SELECT m.id FROM brainx_memories m
       WHERE m.superseded_by IS NOT NULL
         AND m.superseded_by != 'expired'
         AND NOT EXISTS (SELECT 1 FROM brainx_memories t WHERE t.id = m.superseded_by)`
    );
    const count = res.rows.length;
    if (count === 0) return { status: 'ok', label: 'Orphaned references', detail: '0' };
    return {
      status: 'warn', label: 'Orphaned references',
      detail: `${count} orphaned superseded_by refs`,
      verbose: res.rows.map(r => `orphan: ${r.id}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Orphaned references', detail: err.message };
  }
}

async function checkNullEmbeddings(db) {
  try {
    const res = await db.query(
      `SELECT id FROM brainx_memories WHERE embedding IS NULL AND superseded_by IS NULL`
    );
    const count = res.rows.length;
    if (count === 0) return { status: 'ok', label: 'Null embeddings', detail: '0' };
    return {
      status: 'warn', label: 'Null embeddings',
      detail: `${count} memories without embeddings`,
      verbose: res.rows.slice(0, 20).map(r => `no embedding: ${r.id}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Null embeddings', detail: err.message };
  }
}

async function checkExpiredMemories(db) {
  try {
    const colCheck = await db.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'brainx_memories' AND column_name = 'expires_at'`
    );
    if (colCheck.rows.length === 0) {
      return { status: 'info', label: 'Expired memories', detail: 'skipped (no expires_at column)' };
    }
    const res = await db.query(
      `SELECT id FROM brainx_memories
       WHERE expires_at IS NOT NULL AND expires_at < NOW() AND superseded_by IS NULL`
    );
    const count = res.rows.length;
    if (count === 0) return { status: 'ok', label: 'Expired memories', detail: '0' };
    return {
      status: 'fail', label: 'Expired memories',
      detail: `${count} need cleanup`,
      verbose: res.rows.slice(0, 20).map(r => `expired: ${r.id}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Expired memories', detail: err.message };
  }
}

async function checkSensitivityCalibration(db) {
  try {
    const res = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE superseded_by IS NULL
             AND COALESCE(sensitivity, 'normal') = 'normal'
             AND COALESCE(tags, '{}') @> ARRAY['pii:redacted']::text[]
             AND NOT (
               COALESCE(tags, '{}') @> ARRAY['pii:credit_card']::text[]
               AND NOT EXISTS (
                 SELECT 1
                 FROM unnest(COALESCE(tags, '{}')) AS tag
                 WHERE tag LIKE 'pii:%'
                   AND tag NOT IN ('pii:redacted', 'pii:credit_card')
               )
               AND COALESCE(content, '') !~* '(credit|card|visa|mastercard|amex|payment|billing|stripe|tarjeta)'
             )
         )::int AS redacted_normal,
         COUNT(*) FILTER (
           WHERE superseded_by IS NULL
             AND COALESCE(sensitivity, 'normal') = 'sensitive'
         )::int AS sensitive_count,
         COUNT(*) FILTER (
           WHERE superseded_by IS NULL
             AND COALESCE(sensitivity, 'normal') = 'restricted'
         )::int AS restricted_count
       FROM brainx_memories`
    );
    const row = res.rows[0] || {};
    const redactedNormal = Number(row.redacted_normal || 0);
    const sensitiveCount = Number(row.sensitive_count || 0);
    const restrictedCount = Number(row.restricted_count || 0);
    const detail = `sensitive=${sensitiveCount}, restricted=${restrictedCount}, redacted_normal=${redactedNormal}`;

    if (redactedNormal === 0) {
      return { status: 'ok', label: 'Sensitivity calibration', detail };
    }
    return { status: 'fail', label: 'Sensitivity calibration', detail };
  } catch (err) {
    return { status: 'fail', label: 'Sensitivity calibration', detail: err.message };
  }
}

async function checkStaleMemories(db) {
  try {
    const res = await db.query(
      `SELECT id, tier FROM brainx_memories
       WHERE tier IN ('hot', 'warm') AND superseded_by IS NULL
         AND last_accessed < NOW() - INTERVAL '30 days'`
    );
    const count = res.rows.length;
    if (count === 0) return { status: 'ok', label: 'Stale memories', detail: '0 stale hot/warm' };
    return {
      status: 'warn', label: 'Stale memories',
      detail: `${count} hot/warm not accessed in >30d`,
      verbose: res.rows.slice(0, 20).map(r => `stale ${r.tier}: ${r.id}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Stale memories', detail: err.message };
  }
}

async function checkLegacyProvenance(db) {
  try {
    const colCheck = await db.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'brainx_memories' AND column_name = 'source_kind'`
    );
    if (colCheck.rows.length === 0) {
      return { status: 'warn', label: 'Legacy memories', detail: 'source_kind column missing (run migrations)' };
    }
    const res = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM brainx_memories
       WHERE source_kind IS NULL AND superseded_by IS NULL`
    );
    const count = res.rows[0]?.cnt || 0;
    if (count === 0) return { status: 'ok', label: 'Legacy memories', detail: 'all have source_kind' };
    return { status: 'warn', label: 'Legacy memories', detail: `${count} without source_kind` };
  } catch (err) {
    return { status: 'fail', label: 'Legacy memories', detail: err.message };
  }
}

async function checkDuplicateCandidates(db) {
  try {
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM brainx_memories
       WHERE embedding IS NOT NULL AND superseded_by IS NULL`
    );
    if ((countRes.rows[0]?.cnt || 0) < 2) {
      return { status: 'ok', label: 'Duplicates', detail: 'not enough memories to check' };
    }
    const res = await db.query(
      `WITH recent AS (
         SELECT id, type, agent, context, source_kind, embedding
         FROM brainx_memories
         WHERE embedding IS NOT NULL AND superseded_by IS NULL
         ORDER BY created_at DESC LIMIT 100
       )
       SELECT a.id AS id_a, b.id AS id_b,
              1 - (a.embedding <=> b.embedding) AS similarity
       FROM recent a, recent b
       WHERE a.id < b.id
         AND a.type = b.type
         AND COALESCE(a.agent, '') = COALESCE(b.agent, '')
         AND COALESCE(a.context, '') <> ''
         AND COALESCE(a.context, '') = COALESCE(b.context, '')
         AND COALESCE(a.source_kind, '') = COALESCE(b.source_kind, '')
         AND 1 - (a.embedding <=> b.embedding) > 0.95
       ORDER BY similarity DESC LIMIT 20`
    );
    const count = res.rows.length;
    if (count === 0) return { status: 'ok', label: 'Duplicates', detail: '0 scoped pairs >0.95 in sample' };
    return {
      status: 'warn', label: 'Duplicates',
      detail: `${count} scoped high-similarity pairs in last 100`,
      verbose: res.rows.map(r => `${r.id_a} ↔ ${r.id_b} (${Number(r.similarity).toFixed(4)})`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Duplicates', detail: err.message };
  }
}

async function checkTierDistribution(db) {
  try {
    const res = await db.query(
      `SELECT COALESCE(tier, 'unknown') AS tier, COUNT(*)::int AS cnt
       FROM brainx_memories WHERE superseded_by IS NULL GROUP BY 1 ORDER BY 2 DESC`
    );
    return { status: 'info', label: 'tier_distribution', detail: res.rows };
  } catch (err) {
    return { status: 'fail', label: 'tier_distribution', detail: err.message };
  }
}

async function checkTypeDistribution(db) {
  try {
    const res = await db.query(
      `SELECT COALESCE(type, 'unknown') AS type, COUNT(*)::int AS cnt
       FROM brainx_memories WHERE superseded_by IS NULL GROUP BY 1 ORDER BY 2 DESC`
    );
    return { status: 'info', label: 'type_distribution', detail: res.rows };
  } catch (err) {
    return { status: 'fail', label: 'type_distribution', detail: err.message };
  }
}

async function checkTotalMemories(db) {
  try {
    const res = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM brainx_memories WHERE superseded_by IS NULL`
    );
    return { status: 'info', label: 'total_active', detail: res.rows[0]?.cnt || 0 };
  } catch (err) {
    return { status: 'fail', label: 'total_active', detail: err.message };
  }
}

async function checkScaleReadiness(db) {
  try {
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM brainx_memories WHERE embedding IS NOT NULL AND superseded_by IS NULL`
    );
    const count = countRes.rows[0]?.cnt || 0;
    const WARN_THRESHOLD = 8000;
    const CRITICAL_THRESHOLD = 10000;

    // Check if IVFFlat index already exists
    const idxRes = await db.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE tablename = 'brainx_memories'
         AND (
           indexdef LIKE '%USING hnsw%'
           OR indexdef LIKE '%USING ivfflat%'
         )`
    );
    const vectorIndex = idxRes.rows[0] || null;
    const vectorMethod = vectorIndex?.indexdef?.includes('USING hnsw')
      ? 'HNSW'
      : vectorIndex?.indexdef?.includes('USING ivfflat')
        ? 'IVFFlat'
        : null;

    if (vectorMethod) {
      return { status: 'ok', label: 'Scale readiness', detail: `${count} memories, ${vectorMethod} index active` };
    }
    if (count >= CRITICAL_THRESHOLD) {
      return {
        status: 'fail', label: 'Scale readiness',
        detail: `${count} memories — vector ANN index needed NOW for <200ms search`,
        verbose: [
          'Run: CREATE INDEX ON brainx_memories USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);',
          'Current brute-force scan degrades linearly with memory count.'
        ]
      };
    }
    if (count >= WARN_THRESHOLD) {
      return {
        status: 'warn', label: 'Scale readiness',
        detail: `${count}/${CRITICAL_THRESHOLD} — approaching ANN index threshold`,
        verbose: ['Plan a vector ANN index before reaching 10,000 memories.']
      };
    }
    return { status: 'ok', label: 'Scale readiness', detail: `${count} memories, brute-force OK (threshold: ${CRITICAL_THRESHOLD})` };
  } catch (err) {
    return { status: 'fail', label: 'Scale readiness', detail: err.message };
  }
}

function checkHookStatus() {
  const exists = fs.existsSync(HOOK_PATH);
  return { status: exists ? 'ok' : 'warn', label: 'Bootstrap hook', detail: exists ? 'OK' : 'handler.js not found' };
}

function checkLiveCaptureHookStatus() {
  const exists = fs.existsSync(LIVE_HOOK_PATH);
  return { status: exists ? 'ok' : 'warn', label: 'Live capture hook', detail: exists ? 'OK' : 'handler.js not found' };
}

function checkCliAvailable() {
  const cliPath = path.join(__dirname, 'cli.js');
  const exists = fs.existsSync(cliPath);
  return { status: exists ? 'ok' : 'warn', label: 'CLI available', detail: exists ? 'OK' : 'cli.js not found' };
}

function checkFeatureFiles() {
  const missing = FEATURE_FILES.filter((relativePath) => !fs.existsSync(path.join(BRAINX_ROOT, relativePath)));
  const found = FEATURE_FILES.length - missing.length;
  if (missing.length === 0) {
    return { status: 'ok', label: 'Feature files', detail: `${found}/${FEATURE_FILES.length}` };
  }
  return {
    status: 'warn',
    label: 'Feature files',
    detail: `${found}/${FEATURE_FILES.length} present`,
    verbose: missing.map((relativePath) => `missing: ${relativePath}`)
  };
}

function checkManagedHookSync() {
  const drift = [];

  if (!fs.existsSync(HOOK_SOURCE_PATH) || !fs.existsSync(HOOK_PATH)) {
    return { status: 'fail', label: 'Managed hook sync', detail: 'missing source or deployed handler.js' };
  }

  const sourceHandler = fs.readFileSync(HOOK_SOURCE_PATH, 'utf8');
  const deployedHandler = fs.readFileSync(HOOK_PATH, 'utf8');
  if (sourceHandler !== deployedHandler) {
    drift.push('handler.js desync');
  }

  if (!fs.existsSync(HOOK_PROFILES_SOURCE_PATH) || !fs.existsSync(HOOK_PROFILES_PATH)) {
    drift.push('agent-profiles.json missing');
  } else {
    const sourceProfiles = fs.readFileSync(HOOK_PROFILES_SOURCE_PATH, 'utf8');
    const deployedProfiles = fs.readFileSync(HOOK_PROFILES_PATH, 'utf8');
    if (sourceProfiles !== deployedProfiles) {
      drift.push('agent-profiles.json desync');
    }
  }

  if (!fs.existsSync(LIVE_HOOK_SOURCE_PATH) || !fs.existsSync(LIVE_HOOK_PATH)) {
    drift.push('live-capture handler.js missing');
  } else {
    const sourceLiveHandler = fs.readFileSync(LIVE_HOOK_SOURCE_PATH, 'utf8');
    const deployedLiveHandler = fs.readFileSync(LIVE_HOOK_PATH, 'utf8');
    if (sourceLiveHandler !== deployedLiveHandler) {
      drift.push('live-capture handler.js desync');
    }
  }

  if (drift.length === 0) {
    return { status: 'ok', label: 'Managed hook sync', detail: 'source == deployed' };
  }

  return {
    status: 'warn',
    label: 'Managed hook sync',
    detail: drift.join(', '),
    verbose: drift
  };
}

function checkRuntimeRouteGovernance() {
  const state = getRuntimeGovernanceState();
  if (!state) {
    return { status: 'fail', label: 'Runtime route governance', detail: 'cannot read openclaw.json' };
  }

  const promptDualRoute = state.internalBootstrap && state.pluginPromptRoute;
  const executionDualRoute = state.internalLiveCapture && state.pluginExecutionRoute;
  if (promptDualRoute || executionDualRoute) {
    return {
      status: 'fail',
      label: 'Runtime route governance',
      detail: 'duplicate BrainX runtime routes are active',
      verbose: [
        `internal_bootstrap=${state.internalBootstrap}`,
        `internal_live_capture=${state.internalLiveCapture}`,
        `plugin_prompt_route=${state.pluginPromptRoute}`,
        `plugin_execution_route=${state.pluginExecutionRoute}`,
      ]
    };
  }

  if (!state.pluginEnabled && !state.internalBootstrap && !state.internalLiveCapture) {
    return {
      status: 'warn',
      label: 'Runtime route governance',
      detail: 'no BrainX runtime route is active',
    };
  }

  if (state.internalBootstrap || state.internalLiveCapture) {
    return {
      status: 'warn',
      label: 'Runtime route governance',
      detail: 'legacy BrainX hooks still own part of runtime',
      verbose: [
        `internal_bootstrap=${state.internalBootstrap}`,
        `internal_live_capture=${state.internalLiveCapture}`,
      ]
    };
  }

  const workingMemoryScope = state.pluginConfig.workingMemory ? 'global' : 'off';
  const optedInCount = state.enabledAgents.length;

  return {
    status: 'ok',
    label: 'Runtime route governance',
    detail: `plugin sole route (wikiDigest=${Boolean(state.pluginConfig.wikiDigest)}, jitRecall=${Boolean(state.pluginConfig.jitRecall)}, workingMemory=${workingMemoryScope}, toolAdvisories=${Boolean(state.pluginConfig.toolAdvisories)}, captureToolFailures=${Boolean(state.pluginConfig.captureToolFailures)}, bootstrapMode=${state.pluginConfig.bootstrapMode || 'off'}, captureOutboundMode=${state.pluginConfig.captureOutboundMode || 'off'}, agentOptIn=${state.pluginConfig.enforceAgentOptIn !== false ? `on(${optedInCount})` : 'off'})`,
  };
}

function formatAgeShort(iso) {
  if (!iso) return 'never';
  const ageMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ageMs) || ageMs < 0) return iso;
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 1) return '<1h ago';
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatMs(value) {
  if (value === null || value === undefined || value === '') return 'n/a';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric}ms` : 'n/a';
}

function inferWrapperStepSchedule(wrapperSource, needle) {
  if (!wrapperSource || !needle) return 'unknown';
  const stepIndex = wrapperSource.indexOf(needle);
  if (stepIndex === -1) return 'off';
  const weeklyMarker = wrapperSource.indexOf('# ── WEEKLY STEPS');
  if (weeklyMarker === -1) return 'daily';
  return stepIndex < weeklyMarker ? 'daily' : 'sunday';
}

function getWrapperStepSchedule(needle) {
  return inferWrapperStepSchedule(readTextFileSafe(DAILY_CORE_WRAPPER_PATH), needle);
}

function getSurfaceFreshnessThresholds(schedule) {
  switch (schedule) {
    case 'daily':
      return { warnDays: 2, failDays: 7 };
    case 'sunday':
      return { warnDays: 14, failDays: 28 };
    case 'off':
      return { warnDays: 7, failDays: null };
    default:
      return { warnDays: 7, failDays: 21 };
  }
}

function normalizeSurfacePolicyState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'manual' || normalized === 'dormant' || normalized === 'disabled') {
    return normalized;
  }
  return 'active';
}

function readSurfacePolicyRegistry() {
  return readJsonFileSafe(SURFACE_POLICY_PATH);
}

function getSurfacePolicy(surfaceKey) {
  if (!surfaceKey) return null;
  const registry = readSurfacePolicyRegistry();
  const raw = registry?.surfaces?.[surfaceKey];
  if (!raw || typeof raw !== 'object') return null;
  return {
    key: surfaceKey,
    state: normalizeSurfacePolicyState(raw.state),
    owner: typeof raw.owner === 'string' && raw.owner.trim() ? raw.owner.trim() : 'unknown',
    expectedSchedule: typeof raw.expectedSchedule === 'string' && raw.expectedSchedule.trim()
      ? raw.expectedSchedule.trim().toLowerCase()
      : 'unknown',
    note: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : null,
    configKey: typeof raw.configKey === 'string' && raw.configKey.trim() ? raw.configKey.trim() : null,
    script: typeof raw.script === 'string' && raw.script.trim() ? raw.script.trim() : null
  };
}

function buildSurfaceFreshnessCheck({ surfaceKey, label, table, total, lastAt, schedule, policy = getSurfacePolicy(surfaceKey), nowMs = Date.now() }) {
  const count = Number(total || 0);
  const policyState = normalizeSurfacePolicyState(policy?.state);
  const expectedSchedule = policy?.expectedSchedule || 'unknown';
  const { warnDays, failDays } = getSurfaceFreshnessThresholds(schedule);
  const detailPrefix = policyState === 'active' ? '' : `policy=${policyState}, `;
  const detail = `${detailPrefix}rows=${count}, last=${formatAgeShort(lastAt)}, schedule=${schedule}`;
  const verbose = [
    `table=${table}`,
    `surface_key=${surfaceKey || 'n/a'}`,
    `policy_state=${policyState}`,
    `expected_schedule=${expectedSchedule}`,
    `last_at=${lastAt || 'never'}`,
    `warn_after=${warnDays}d`,
    `fail_after=${failDays == null ? 'n/a' : `${failDays}d`}`,
    `wrapper=${DAILY_CORE_WRAPPER_PATH}`
  ];
  if (policy?.owner) verbose.push(`owner=${policy.owner}`);
  if (policy?.script) verbose.push(`script=${policy.script}`);
  if (policy?.configKey) verbose.push(`config_key=${policy.configKey}`);
  if (policy?.note) verbose.push(`policy_note=${policy.note}`);

  const scheduleMismatch = expectedSchedule !== 'unknown' && expectedSchedule !== schedule;
  if (scheduleMismatch) {
    return {
      status: policyState === 'active' ? 'fail' : 'warn',
      label,
      detail: `${detail}, expected_schedule=${expectedSchedule}`,
      verbose
    };
  }

  if (policyState !== 'active') {
    return { status: 'ok', label, detail, verbose };
  }

  if (count === 0) {
    const status = schedule === 'daily' || schedule === 'sunday' ? 'fail' : 'warn';
    return { status, label, detail, verbose };
  }

  const lastMs = parseIsoMs(lastAt);
  if (lastMs == null) {
    return { status: 'fail', label, detail: `rows=${count}, last=invalid, schedule=${schedule}`, verbose };
  }

  const ageDays = (nowMs - lastMs) / (1000 * 60 * 60 * 24);
  if (failDays != null && ageDays > failDays) {
    return { status: 'fail', label, detail, verbose };
  }
  if (ageDays > warnDays) {
    return { status: 'warn', label, detail, verbose };
  }
  return { status: 'ok', label, detail, verbose };
}

function checkLiveCaptureTelemetry() {
  try {
    const runtimeState = getRuntimeGovernanceState();
    const liveRouteActive = Boolean(
      runtimeState && (
        runtimeState.internalLiveCapture ||
        runtimeState.pluginExecutionRoute ||
        (runtimeState.pluginConfig?.captureOutboundMode && runtimeState.pluginConfig.captureOutboundMode !== 'off')
      )
    );
    const summary = summarizeLiveCapture({ days: 7 });
    if (!summary.exists) {
      return {
        status: liveRouteActive ? 'warn' : 'ok',
        label: 'Live capture telemetry',
        detail: liveRouteActive ? 'no telemetry log yet' : 'runtime disabled by config; no telemetry expected',
        telemetry: summary,
        verbose: [`log: ${summary.logPath}`]
      };
    }

    const day = summary.last_24h || {};
    const failures24h = Number(day.capture_failed || 0) + Number(day.daily_memory_failures || 0) + Number(day.brainx_store_failures || 0);
    const captureRatio7d = Number(summary.totals.seen || 0) > 0
      ? Number(summary.totals.captured || 0) / Number(summary.totals.seen || 1)
      : 0;
    const lowSignalRatio7d = Number(summary.totals.seen || 0) > 0
      ? Number(summary.totals.low_signal || 0) / Number(summary.totals.seen || 1)
      : 0;
    const detail = `24h seen=${day.seen || 0} captured=${day.captured || 0} low=${day.low_signal || 0} dup=${day.duplicate || 0} fail=${failures24h} last_success=${formatAgeShort(summary.last_success_at)}`;

    let status = 'ok';
    if (!liveRouteActive) {
      status = 'ok';
    } else if (!summary.last_seen_at) {
      status = 'warn';
    } else if ((Date.now() - Date.parse(summary.last_seen_at)) > (72 * 60 * 60 * 1000)) {
      status = 'warn';
    }
    if (failures24h > 0) status = 'warn';
    if (liveRouteActive && summary.totals.seen >= 50 && !summary.totals.captured) status = 'warn';
    if (liveRouteActive && summary.last_success_at && (Date.now() - Date.parse(summary.last_success_at)) > (72 * 60 * 60 * 1000)) {
      status = 'warn';
    }
    if (liveRouteActive && summary.totals.seen >= 50 && lowSignalRatio7d >= 0.9) status = 'warn';

    return {
      status,
      label: 'Live capture telemetry',
      detail: liveRouteActive ? detail : `runtime disabled by config; ${detail}`,
      telemetry: summary,
      verbose: [
        `log: ${summary.logPath}`,
        `7d seen=${summary.totals.seen} captured=${summary.totals.captured} low=${summary.totals.low_signal} dup=${summary.totals.duplicate} capture_failed=${summary.totals.capture_failed}`,
        `7d capture_ratio=${captureRatio7d.toFixed(3)} low_signal_ratio=${lowSignalRatio7d.toFixed(3)}`,
        `7d daily_memory_failures=${summary.totals.daily_memory_failures} brainx_store_failures=${summary.totals.brainx_store_failures}`,
        `latency avg=${formatMs(summary.last_24h?.latencies?.avg_ms)} p95=${formatMs(summary.last_24h?.latencies?.p95_ms)} max=${formatMs(summary.last_24h?.latencies?.max_ms)}`,
        `last_seen_at=${summary.last_seen_at || 'never'}`,
        `last_success_at=${summary.last_success_at || 'never'}`,
        `last_error_at=${summary.last_error_at || 'never'}`,
        `last_error=${summary.last_error || 'none'}`
      ]
    };
  } catch (err) {
    return { status: 'fail', label: 'Live capture telemetry', detail: err.message };
  }
}

async function checkLearningDetailsFreshness(db) {
  try {
    const res = await db.query(
      `SELECT COUNT(*)::int AS total, MAX(created_at) AS last_at
       FROM brainx_learning_details`
    );
    const row = res.rows[0] || {};
    return buildSurfaceFreshnessCheck({
      surfaceKey: 'learning_details',
      label: 'Learning details freshness',
      table: 'brainx_learning_details',
      total: row.total,
      lastAt: row.last_at,
      schedule: getWrapperStepSchedule('scripts/learning-detail-extractor.js')
    });
  } catch (err) {
    return { status: 'fail', label: 'Learning details freshness', detail: err.message };
  }
}

async function checkSessionSnapshotsFreshness(db) {
  try {
    const res = await db.query(
      `SELECT COUNT(*)::int AS total, MAX(COALESCE(session_end, session_start)) AS last_at
       FROM brainx_session_snapshots`
    );
    const row = res.rows[0] || {};
    return buildSurfaceFreshnessCheck({
      surfaceKey: 'session_snapshots',
      label: 'Session snapshots freshness',
      table: 'brainx_session_snapshots',
      total: row.total,
      lastAt: row.last_at,
      schedule: getWrapperStepSchedule('scripts/session-snapshot.js')
    });
  } catch (err) {
    return { status: 'fail', label: 'Session snapshots freshness', detail: err.message };
  }
}

async function checkTrajectoriesFreshness(db) {
  try {
    const res = await db.query(
      `SELECT COUNT(*)::int AS total, MAX(created_at) AS last_at
       FROM brainx_trajectories`
    );
    const row = res.rows[0] || {};
    return buildSurfaceFreshnessCheck({
      surfaceKey: 'trajectories',
      label: 'Trajectories freshness',
      table: 'brainx_trajectories',
      total: row.total,
      lastAt: row.last_at,
      schedule: getWrapperStepSchedule('scripts/trajectory-recorder.js')
    });
  } catch (err) {
    return { status: 'fail', label: 'Trajectories freshness', detail: err.message };
  }
}

async function checkWorkingMemoryHygiene() {
  try {
    const stats = await getWorkingMemoryStats();
    if ((stats.fileCount || 0) === 0) {
      return { status: 'ok', label: 'Working memory hygiene', detail: 'no state files present' };
    }

    const detail = `files=${stats.fileCount} open=${stats.openCount} closed=${stats.closedCount} stale_open=${stats.staleOpenCount} contaminated=${stats.contaminatedCount}`;
    let status = 'ok';
    if ((stats.contaminatedCount || 0) > 0 || (stats.staleOpenCount || 0) > 0) status = 'warn';
    if ((stats.openCount || 0) > 20) status = 'warn';

    return { status, label: 'Working memory hygiene', detail };
  } catch (err) {
    return { status: 'fail', label: 'Working memory hygiene', detail: err.message };
  }
}

async function checkAdvisoryFeedbackLoop(db) {
  try {
    const policy = getSurfacePolicy('advisory_feedback');
    const policyState = normalizeSurfacePolicyState(policy?.state);
    const runtimeState = getRuntimeGovernanceState();
    const toolAdvisoriesEnabled = Boolean(runtimeState?.pluginConfig?.toolAdvisories);
    const res = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE was_followed IS NOT NULL)::int AS explicit_feedback,
         COUNT(*) FILTER (WHERE was_followed IS TRUE)::int AS followed_yes,
         COUNT(*) FILTER (WHERE was_followed IS FALSE)::int AS followed_no,
         COUNT(*) FILTER (WHERE outcome IS NOT NULL AND btrim(outcome) <> '')::int AS outcomes
       FROM brainx_advisories`
    );
    const row = res.rows[0] || {};
    const total = Number(row.total || 0);
    const explicitFeedback = Number(row.explicit_feedback || 0);
    const outcomes = Number(row.outcomes || 0);
    const baseDetail = `${total} advisories, explicit_feedback=${explicitFeedback}, outcomes=${outcomes}`;
    const policyVerbose = [
      `policy_state=${policyState}`,
      `toolAdvisories=${toolAdvisoriesEnabled}`,
      `expected_schedule=${policy?.expectedSchedule || 'unknown'}`
    ];
    if (policy?.owner) policyVerbose.push(`owner=${policy.owner}`);
    if (policy?.configKey) policyVerbose.push(`config_key=${policy.configKey}`);
    if (policy?.note) policyVerbose.push(`policy_note=${policy.note}`);

    if (policyState !== 'active') {
      return {
        status: toolAdvisoriesEnabled && policyState === 'disabled' ? 'warn' : 'ok',
        label: 'Advisory feedback loop',
        detail: `policy=${policyState}, runtime=${toolAdvisoriesEnabled ? 'on' : 'off'}, ${baseDetail}`,
        verbose: policyVerbose
      };
    }

    if (total === 0) {
      return { status: 'warn', label: 'Advisory feedback loop', detail: 'no advisory records yet' };
    }

    const explicitRate = explicitFeedback / total;
    const outcomeRate = outcomes / total;
    const detail = baseDetail;
    if (total >= 25 && explicitRate < 0.05) {
      return {
        status: 'warn',
        label: 'Advisory feedback loop',
        detail,
        verbose: [
          ...policyVerbose,
          `explicit_feedback_rate=${explicitRate.toFixed(3)}`,
          `outcome_rate=${outcomeRate.toFixed(3)}`,
          `followed_yes=${Number(row.followed_yes || 0)}`,
          `followed_no=${Number(row.followed_no || 0)}`,
        ]
      };
    }

    return {
      status: 'ok',
      label: 'Advisory feedback loop',
      detail,
      verbose: [
        ...policyVerbose,
        `explicit_feedback_rate=${explicitRate.toFixed(3)}`,
        `outcome_rate=${outcomeRate.toFixed(3)}`,
      ]
    };
  } catch (err) {
    return { status: 'fail', label: 'Advisory feedback loop', detail: err.message };
  }
}

async function checkEidosAdoption(db) {
  try {
    const policy = getSurfacePolicy('eidos');
    const policyState = normalizeSurfacePolicyState(policy?.state);
    const res = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS last_30d,
         MAX(created_at) AS last_cycle_at
       FROM brainx_eidos_cycles`
    );
    const row = res.rows[0] || {};
    const total = Number(row.total || 0);
    const recent = Number(row.last_30d || 0);
    const detail = `${total} total cycles, ${recent} in last 30d, last=${formatAgeShort(row.last_cycle_at)}`;
    const verbose = [
      `policy_state=${policyState}`,
      `expected_schedule=${policy?.expectedSchedule || 'unknown'}`
    ];
    if (policy?.owner) verbose.push(`owner=${policy.owner}`);
    if (policy?.note) verbose.push(`policy_note=${policy.note}`);

    if (policyState !== 'active') {
      return { status: 'ok', label: 'EIDOS adoption', detail: `policy=${policyState}, ${detail}`, verbose };
    }

    if (total === 0) {
      return { status: 'warn', label: 'EIDOS adoption', detail: '0 cycles recorded' };
    }
    if (recent === 0) {
      return { status: 'warn', label: 'EIDOS adoption', detail };
    }
    return { status: recent < 5 ? 'warn' : 'ok', label: 'EIDOS adoption', detail };
  } catch (err) {
    return { status: 'fail', label: 'EIDOS adoption', detail: err.message };
  }
}

function checkPromotionSink() {
  try {
    const canonical = readCanonicalRules();
    if (!canonical.exists) {
      return { status: 'fail', label: 'Promotion sink', detail: `missing: ${CANONICAL_RULES_FILE}` };
    }

    const templateAgents = readTextFileSafe(AGENT_CORE_TEMPLATE_AGENTS) || '';
    const templateTools = readTextFileSafe(AGENT_CORE_TEMPLATE_TOOLS) || '';
    const canonicalAliases = [CANONICAL_RULES_FILE, CANONICAL_RULES_FILE.replace(process.env.HOME || '', '~')];
    const agentsReferences = canonicalAliases.some((alias) => templateAgents.includes(alias));
    const toolsReferences = canonicalAliases.some((alias) => templateTools.includes(alias));
    const templateReferences = agentsReferences && toolsReferences;
    const markerCoverage = Object.values(canonical.sections).every((section) => section.markersPresent);
    const totalRules = Object.values(canonical.sections).reduce((sum, section) => sum + section.rules.length, 0);
    const detail = `rules=${totalRules}, updated=${canonical.updatedAt || 'unknown'}, templates_reference=${templateReferences}`;
    const verbose = [
      `canonical=${canonical.filePath}`,
      `agents_references=${agentsReferences}`,
      `tools_references=${toolsReferences}`,
      `workflow_rules=${canonical.sections.workflow.rules.length}`,
      `tools_rules=${canonical.sections.tools.rules.length}`,
      `behavior_rules=${canonical.sections.behavior.rules.length}`,
      `markers_present=${markerCoverage}`,
    ];
    if (!templateReferences || !markerCoverage) {
      return { status: 'warn', label: 'Promotion sink', detail, verbose };
    }
    return { status: 'ok', label: 'Promotion sink', detail, verbose };
  } catch (err) {
    return { status: 'fail', label: 'Promotion sink', detail: err.message };
  }
}

async function checkPromotionSuggestionQueue(db) {
  try {
    const res = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE(status, 'pending') = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE COALESCE(status, 'pending') = 'pending' AND created_at < NOW() - INTERVAL '7 days')::int AS pending_stale,
         MIN(created_at) FILTER (WHERE COALESCE(status, 'pending') = 'pending') AS oldest_pending_at,
         COUNT(*) FILTER (WHERE COALESCE(status, 'pending') IN ('promoted', 'applied'))::int AS promoted
       FROM brainx_memories
       WHERE 'promotion-suggestion' = ANY(COALESCE(tags, '{}'))`
    );
    const row = res.rows[0] || {};
    const pending = Number(row.pending || 0);
    const stale = Number(row.pending_stale || 0);
    const promoted = Number(row.promoted || 0);
    const detail = `pending=${pending}, stale_pending=${stale}, promoted=${promoted}, oldest_pending=${formatAgeShort(row.oldest_pending_at)}`;
    if (stale > 0) {
      return { status: 'warn', label: 'Promotion suggestion queue', detail };
    }
    return { status: 'ok', label: 'Promotion suggestion queue', detail };
  } catch (err) {
    return { status: 'fail', label: 'Promotion suggestion queue', detail: err.message };
  }
}

async function checkPromotionSuggestionDrift(db) {
  try {
    const res = await db.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE COALESCE(status, 'pending') IN ('promoted', 'applied')
             AND COALESCE(promoted_to, '') = ''
         )::int AS missing_target,
         COUNT(*) FILTER (
           WHERE COALESCE(status, 'pending') IN ('promoted', 'applied')
             AND COALESCE(promoted_to, '') <> ''
             AND promoted_to NOT LIKE 'brainx_promoted_rules:%'
         )::int AS invalid_target
       FROM brainx_memories
       WHERE 'promotion-suggestion' = ANY(COALESCE(tags, '{}'))`
    );
    const row = res.rows[0] || {};
    const missingTarget = Number(row.missing_target || 0);
    const invalidTarget = Number(row.invalid_target || 0);
    const detail = `missing_target=${missingTarget}, invalid_target=${invalidTarget}`;
    if (missingTarget > 0 || invalidTarget > 0) {
      return { status: 'warn', label: 'Promotion suggestion drift', detail };
    }
    return { status: 'ok', label: 'Promotion suggestion drift', detail };
  } catch (err) {
    return { status: 'fail', label: 'Promotion suggestion drift', detail: err.message };
  }
}

function checkCommandResolution() {
  try {
    const resolved = execFileSync('bash', ['-lc', 'readlink -f "$(command -v brainx)"'], {
      encoding: 'utf8',
      env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
      timeout: 5000
    }).trim();
    const expected = path.join(BRAINX_ROOT, 'brainx');
    if (resolved === expected) {
      return { status: 'ok', label: 'Command resolution', detail: resolved };
    }
    return { status: 'warn', label: 'Command resolution', detail: resolved, verbose: [`expected: ${expected}`] };
  } catch (err) {
    return { status: 'fail', label: 'Command resolution', detail: err.message };
  }
}

function checkEmbeddingEnv() {
  const hasDbUrl = Boolean(process.env.DATABASE_URL);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  if (hasDbUrl && hasOpenAI) {
    return { status: 'ok', label: 'Embedding env', detail: 'DATABASE_URL + OPENAI_API_KEY present' };
  }
  const missing = [];
  if (!hasDbUrl) missing.push('DATABASE_URL');
  if (!hasOpenAI) missing.push('OPENAI_API_KEY');
  return { status: 'warn', label: 'Embedding env', detail: `missing: ${missing.join(', ')}` };
}

function checkCommandSurface() {
  try {
    const cliSource = fs.readFileSync(CLI_PATH, 'utf8');
    const missing = EXPECTED_COMMANDS.filter((cmd) => !cliSource.includes(`'${cmd}'`) && !cliSource.includes(`"${cmd}"`));
    const found = EXPECTED_COMMANDS.length - missing.length;
    if (missing.length === 0) {
      return { status: 'ok', label: 'Command surface', detail: `${found}/${EXPECTED_COMMANDS.length}` };
    }
    return {
      status: 'warn',
      label: 'Command surface',
      detail: `${found}/${EXPECTED_COMMANDS.length} registered`,
      verbose: missing.map((cmd) => `missing command: ${cmd}`)
    };
  } catch (err) {
    return { status: 'fail', label: 'Command surface', detail: err.message };
  }
}

function checkSurfacePolicyRegistry() {
  const registry = readSurfacePolicyRegistry();
  if (!registry || typeof registry !== 'object') {
    return { status: 'fail', label: 'Surface policy registry', detail: `missing or invalid: ${SURFACE_POLICY_PATH}` };
  }

  const surfaces = registry.surfaces && typeof registry.surfaces === 'object' ? registry.surfaces : {};
  const keys = Object.keys(surfaces);
  if (keys.length === 0) {
    return {
      status: 'fail',
      label: 'Surface policy registry',
      detail: 'no surfaces defined',
      verbose: [`path=${SURFACE_POLICY_PATH}`]
    };
  }

  const invalid = keys.filter((key) => {
    const rawState = String(surfaces[key]?.state || '').trim().toLowerCase();
    return !['active', 'manual', 'dormant', 'disabled'].includes(rawState);
  });

  const detail = `${keys.length} surfaces, reviewed=${registry.lastReviewed || 'unknown'}`;
  const verbose = [
    `path=${SURFACE_POLICY_PATH}`,
    ...keys.map((key) => `${key}: ${normalizeSurfacePolicyState(surfaces[key]?.state)} expected=${surfaces[key]?.expectedSchedule || 'unknown'}`)
  ];
  if (invalid.length > 0) {
    return {
      status: 'warn',
      label: 'Surface policy registry',
      detail,
      verbose: [...verbose, ...invalid.map((key) => `invalid_state=${key}:${String(surfaces[key]?.state || '')}`)]
    };
  }

  return { status: 'ok', label: 'Surface policy registry', detail, verbose };
}

async function checkBrainxWikiStatus() {
  try {
    const status = await getWikiStatus();
    if (!status?.compiled) {
      return { status: 'fail', label: 'BrainX Wiki', detail: 'vault not compiled' };
    }

    const counts = status.counts || {};
    const reports = status.reports || {};
    const detail =
      `compiled ${formatAgeShort(status.generatedAt)} ` +
      `docs=${counts.knowledgeDocs || 0} durable=${counts.durableMemories || 0} ` +
      `claims=${counts.claims || 0} digests=${counts.agentDigests || 0} ` +
      `low_conf=${reports.lowConfidence || 0}`;
    const verbose = [
      `vault=${status.vaultDir}`,
      `knowledge_root=${status.knowledgeRoot}`,
      `reports: stale=${reports.stale || 0} open_questions=${reports.openQuestions || 0}`,
    ];

    if (!counts.claims || !counts.agentDigests) {
      return { status: 'fail', label: 'BrainX Wiki', detail, verbose };
    }
    if ((reports.lowConfidence || 0) > 0 || (reports.stale || 0) > 0) {
      return { status: 'warn', label: 'BrainX Wiki', detail, verbose };
    }
    return { status: 'ok', label: 'BrainX Wiki', detail, verbose };
  } catch (err) {
    return { status: 'fail', label: 'BrainX Wiki', detail: err.message };
  }
}

async function checkBrainxWikiLint() {
  try {
    const result = await lintWiki();
    const issues = Array.isArray(result?.issues) ? result.issues : [];
    const errors = issues.filter((issue) => issue.level === 'error');
    const warnings = issues.filter((issue) => issue.level === 'warn');
    const infos = issues.filter((issue) => issue.level === 'info');
    const detail = issues.length === 0
      ? 'ok'
      : `${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`;
    const verbose = issues.map((issue) => `${issue.level}: ${issue.code} | ${issue.message}`);

    if (errors.length > 0) {
      return { status: 'fail', label: 'BrainX Wiki lint', detail, verbose };
    }
    if (warnings.length > 0 || infos.length > 0) {
      return { status: 'warn', label: 'BrainX Wiki lint', detail, verbose };
    }
    return { status: 'ok', label: 'BrainX Wiki lint', detail };
  } catch (err) {
    return { status: 'fail', label: 'BrainX Wiki lint', detail: err.message };
  }
}

async function checkObsidianSupport() {
  try {
    const status = await getWikiStatus();
    const obsidian = status?.obsidian || {};
    const detail =
      `enabled=${Boolean(obsidian.enabled)} cli=${Boolean(obsidian.cliAvailable)} ` +
      `xdg_open=${Boolean(obsidian.xdgOpenAvailable)}`;
    const verbose = [
      `vault=${status.vaultDir}`,
      `cli_path=${obsidian.cliPath || 'n/a'}`,
      `xdg_open_path=${obsidian.xdgOpenPath || 'n/a'}`,
    ];

    if (!obsidian.enabled) {
      return { status: 'warn', label: 'Obsidian support', detail, verbose };
    }
    if (obsidian.cliAvailable || obsidian.xdgOpenAvailable) {
      return { status: 'ok', label: 'Obsidian support', detail, verbose };
    }
    return { status: 'warn', label: 'Obsidian support', detail, verbose };
  } catch (err) {
    return { status: 'fail', label: 'Obsidian support', detail: err.message };
  }
}

function runNodeCheck(label, relativePath, timeout = 20000) {
  try {
    const fullPath = path.join(BRAINX_ROOT, relativePath);
    const output = execFileSync('node', [fullPath], {
      cwd: BRAINX_ROOT,
      encoding: 'utf8',
      env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
      timeout
    }).trim();
    return {
      status: 'ok',
      label,
      detail: 'OK',
      verbose: output ? output.split('\n').slice(-5) : null
    };
  } catch (err) {
    const stderr = String(err.stderr || '').trim();
    const stdout = String(err.stdout || '').trim();
    const detail = stderr || stdout || err.message;
    return { status: 'fail', label, detail };
  }
}

function runCliCheck(label, args, validator, timeout = 20000) {
  try {
    const output = execFileSync('node', [CLI_PATH, ...args], {
      cwd: BRAINX_ROOT,
      encoding: 'utf8',
      env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
      timeout
    }).trim();
    const verdict = validator(output);
    if (verdict === true) {
      return { status: 'ok', label, detail: 'OK' };
    }
    if (typeof verdict === 'string') {
      return { status: 'warn', label, detail: verdict };
    }
    return { status: 'ok', label, detail: 'OK' };
  } catch (err) {
    const stderr = String(err.stderr || '').trim();
    const stdout = String(err.stdout || '').trim();
    const detail = stderr || stdout || err.message;
    return { status: 'fail', label, detail };
  }
}

function runFunctionalChecks(fullMode = false) {
  if (!fullMode) return [];

  return [
    runCliCheck(
      'Health command',
      ['health'],
      (output) => output.includes('BrainX health: OK')
    ),
    runNodeCheck('Test suite', 'tests/cli-v5.js'),
    runNodeCheck('Smoke suite', 'tests/smoke.js'),
    runCliCheck(
      'Search command',
      ['search', '--query', 'openclaw memory prefix duplication', '--limit', '2'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true && Array.isArray(parsed.results);
      }
    ),
    runCliCheck(
      'Inject command',
      ['inject', '--query', 'openclaw memory prefix duplication', '--limit', '2'],
      (output) => output.includes('[sim:')
    ),
    runCliCheck(
      'Metrics command',
      ['metrics', '--days', '7', '--json'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true && parsed.counts && parsed.query_performance;
      }
    ),
    runCliCheck(
      'Wiki status',
      ['wiki', 'status', '--json'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.compiled === true && Number(parsed?.counts?.claims || 0) > 0;
      }
    ),
    runCliCheck(
      'Wiki lint',
      ['wiki', 'lint', '--json'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true;
      }
    ),
    runCliCheck(
      'Wiki digest',
      ['wiki', 'digest', '--agent', 'main', '--json'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true && typeof parsed?.digest?.promptBlock === 'string' && parsed.digest.promptBlock.length > 0;
      }
    ),
    runCliCheck(
      'Facts command',
      ['facts', '--context', 'doctor:nonexistent', '--limit', '1'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true && Number.isInteger(parsed.count);
      }
    ),
    runCliCheck(
      'Features command',
      ['features', '--context', 'doctor:nonexistent', '--limit', '1', '--status', 'pending'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true && Number.isInteger(parsed.count);
      }
    ),
    runCliCheck(
      'Promote candidates',
      ['promote-candidates', '--limit', '1', '--json'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true && Array.isArray(parsed.results);
      }
    ),
    runCliCheck(
      'Advisory command',
      ['advisory', '--tool', 'exec', '--args', '{"command":"pwd"}', '--agent', 'doctor', '--project', 'brainx', '--json'],
      (output) => {
        const parsed = JSON.parse(output);
        return Boolean(parsed.id && parsed.advisory_text);
      }
    ),
    runCliCheck(
      'EIDOS stats',
      ['eidos', 'stats', '--agent', 'echo', '--days', '30', '--json'],
      (output) => {
        const parsed = JSON.parse(output);
        return parsed.ok === true && parsed.counts;
      }
    )
  ];
}

function makeDoctorSuffix() {
  const alpha = crypto.randomBytes(8).toString('base64').replace(/[^a-z]/gi, '').slice(0, 8).toLowerCase();
  return alpha || `doctor${Date.now().toString(36).replace(/[^a-z]/gi, '').slice(0, 8)}`;
}

async function runWritableRoundTripCheck(db) {
  const suffix = makeDoctorSuffix();
  const context = `doctor-write-${suffix}`;
  const noteId = `doctor_note_${suffix}`;
  const factId = `doctor_fact_${suffix}`;
  const featureId = `doctor_feature_${suffix}`;
  const restrictedId = `doctor_restricted_${suffix}`;
  const piiId = `doctor_pii_${suffix}`;
  const restrictedProbe = `Doctor restricted validation ${suffix} alpha sentinel`;
  const createdIds = [];

  const runCliJson = (args) => JSON.parse(execFileSync('node', [CLI_PATH, ...args], {
    cwd: BRAINX_ROOT,
    encoding: 'utf8',
    env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
    timeout: 30000
  }).trim());

  try {
    const addOut = runCliJson([
      'add',
      '--type', 'note',
      '--content', `Doctor writable validation note ${suffix} alpha signal`,
      '--context', context,
      '--tier', 'warm',
      '--importance', '1',
      '--tags', 'doctor,validation',
      '--agent', 'doctor',
      '--id', noteId
    ]);
    createdIds.push(addOut.id);

    const feedbackOut = runCliJson(['feedback', '--id', addOut.id, '--useful', '--json']);
    const resolveOut = runCliJson([
      'resolve',
      '--id', addOut.id,
      '--status', 'resolved',
      '--resolutionNotes', 'doctor writable validation'
    ]);

    const factOut = runCliJson([
      'fact',
      '--content', `Doctor writable validation fact ${suffix} alpha signal`,
      '--context', context,
      '--importance', '2',
      '--tags', 'doctor,validation',
      '--agent', 'doctor',
      '--id', factId
    ]);
    createdIds.push(factOut.id);
    const factsOut = runCliJson(['facts', '--context', context, '--limit', '5']);

    const featureOut = runCliJson([
      'feature',
      '--content', `Doctor writable validation feature ${suffix} alpha signal`,
      '--context', context,
      '--importance', '2',
      '--tags', 'doctor,validation',
      '--agent', 'doctor',
      '--id', featureId
    ]);
    createdIds.push(featureOut.id);
    const featuresOut = runCliJson(['features', '--context', context, '--limit', '5', '--status', 'pending']);

    const restrictedOut = runCliJson([
      'add',
      '--type', 'note',
      '--content', restrictedProbe,
      '--context', context,
      '--tier', 'hot',
      '--importance', '8',
      '--tags', 'doctor,validation',
      '--agent', 'doctor',
      '--id', restrictedId,
      '--sensitivity', 'restricted'
    ]);
    createdIds.push(restrictedOut.id);

    const piiOut = runCliJson([
      'add',
      '--type', 'note',
      '--content', `Credenciales de prueba ${suffix}: login doctor@example.com y password: supersecret1234`,
      '--context', context,
      '--tier', 'warm',
      '--importance', '6',
      '--tags', 'doctor,validation',
      '--agent', 'doctor',
      '--id', piiId
    ]);
    createdIds.push(piiOut.id);

    const searchBlockedOut = runCliJson([
      'search',
      '--query', restrictedProbe,
      '--limit', '10',
      '--minSimilarity', '0'
    ]);
    const injectBlockedOut = execFileSync('node', [
      CLI_PATH,
      'inject',
      '--query', restrictedProbe,
      '--limit', '10',
      '--minSimilarity', '0',
      '--minScore', '-10'
    ], {
      cwd: BRAINX_ROOT,
      encoding: 'utf8',
      env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
      timeout: 30000
    }).trim();

    const stateRes = await db.query(
      `SELECT id, type, status, importance, COALESCE(feedback_score, 0) AS feedback_score, sensitivity, tags
       FROM brainx_memories
       WHERE id = ANY($1::text[])
       ORDER BY id`,
      [createdIds]
    );

    await db.query(`DELETE FROM brainx_memories WHERE id = ANY($1::text[])`, [createdIds]);
    const cleanupRes = await db.query(`SELECT COUNT(*)::int AS cnt FROM brainx_memories WHERE id = ANY($1::text[])`, [createdIds]);

    const factsOk = factsOut.ok === true && Number(factsOut.count) >= 1;
    const featuresOk = featuresOut.ok === true && Number(featuresOut.count) >= 1;
    const feedbackOk = feedbackOut.ok === true && feedbackOut.memory && Number(feedbackOut.memory.feedback_score) >= 1;
    const resolveOk = resolveOut.ok === true && Number(resolveOut.updated) >= 1;
    const cleanupOk = (cleanupRes.rows[0]?.cnt || 0) === 0;
    const stateOk = stateRes.rows.length === 5;
    const restrictedSearchBlocked = !searchBlockedOut.results.some((row) => row.id === restrictedId);
    const restrictedInjectBlocked = !injectBlockedOut.includes(restrictedProbe);
    const sensitivityById = new Map(stateRes.rows.map((row) => [row.id, row]));
    const restrictedStoredOk = sensitivityById.get(restrictedId)?.sensitivity === 'restricted';
    const piiStoredOk = sensitivityById.get(piiId)?.sensitivity === 'restricted';

    if (factsOk && featuresOk && feedbackOk && resolveOk && cleanupOk && stateOk && restrictedSearchBlocked && restrictedInjectBlocked && restrictedStoredOk && piiStoredOk) {
      return {
        status: 'ok',
        label: 'Writable round-trip',
        detail: 'write paths + sensitivity gates OK',
        verbose: stateRes.rows.map((row) => `${row.id} ${row.type} status=${row.status} importance=${row.importance} feedback=${row.feedback_score} sensitivity=${row.sensitivity}`)
      };
    }

    return {
      status: 'fail',
      label: 'Writable round-trip',
      detail: 'one or more write-path validations failed',
      verbose: [
        `facts_ok=${factsOk}`,
        `features_ok=${featuresOk}`,
        `feedback_ok=${feedbackOk}`,
        `resolve_ok=${resolveOk}`,
        `state_ok=${stateOk}`,
        `cleanup_ok=${cleanupOk}`,
        `restricted_search_blocked=${restrictedSearchBlocked}`,
        `restricted_inject_blocked=${restrictedInjectBlocked}`,
        `restricted_stored_ok=${restrictedStoredOk}`,
        `pii_stored_ok=${piiStoredOk}`
      ]
    };
  } catch (err) {
    try {
      if (createdIds.length > 0) {
        await db.query(`DELETE FROM brainx_memories WHERE id = ANY($1::text[])`, [createdIds]);
      }
    } catch (_) {}
    return { status: 'fail', label: 'Writable round-trip', detail: String(err.message || err) };
  }
}

function checkCronJobs() {
  const cronJobsPath = path.join(OPENCLAW_HOME, 'cron', 'jobs.json');
  try {
    const raw = fs.readFileSync(cronJobsPath, 'utf8');
    const data = JSON.parse(raw);
    const jobs = data.jobs || [];

    const normalize = (job) => ((job.name || '') + ' ' + ((job.payload && job.payload.message) || '')).toLowerCase();

    // Current production architecture: a single consolidated OpenClaw cron orchestrates
    // the BrainX V5 daily core pipeline. Legacy component jobs may remain present but
    // disabled after consolidation and should not be required for a healthy system.
    const consolidated = jobs.find(j => {
      const combined = normalize(j);
      return combined.includes('brainx daily core pipeline v5') ||
             (combined.includes('brainx') && combined.includes('daily core pipeline'));
    });

    if (consolidated) {
      const supportDefs = [
        { key: 'daily_closeout', patterns: ['memory daily closeout'] },
        { key: 'knowledge_sync', patterns: ['brainx knowledge sync'] }
      ];
      const supportState = supportDefs.map((def) => {
        const job = jobs.find((entry) => def.patterns.some((pattern) => normalize(entry).includes(pattern)));
        return {
          key: def.key,
          found: Boolean(job),
          enabled: Boolean(job?.enabled),
          name: job?.name || null,
          schedule: job?.schedule || null
        };
      });
      const supportSummary = supportState
        .map((entry) => `${entry.key}=${!entry.found ? 'missing' : entry.enabled ? 'on' : 'off'}`)
        .join(', ');
      const detail = consolidated.enabled
        ? `consolidated pipeline enabled; support: ${supportSummary}`
        : `consolidated pipeline detected but disabled; support: ${supportSummary}`;
      const missingSupport = supportState.filter((entry) => !entry.found);
      const disabledSupport = supportState.filter((entry) => entry.found && !entry.enabled);
      const verbose = [
        `consolidated=${consolidated.name || 'BrainX Daily Core Pipeline V5'} enabled=${Boolean(consolidated.enabled)}`,
        ...supportState.map((entry) => `${entry.key}: name=${entry.name || 'missing'} enabled=${entry.enabled} schedule=${JSON.stringify(entry.schedule)}`)
      ];
      return {
        status: !consolidated.enabled ? 'fail' : (missingSupport.length || disabledSupport.length ? 'warn' : 'ok'),
        label: 'Cron jobs',
        detail,
        verbose,
      };
    }

    // Backward-compatible fallback for older split-cron deployments.
    const keywords = [
      { name: 'Memory Distiller', patterns: ['distiller'] },
      { name: 'Memory Bridge', patterns: ['memory bridge'] },
      { name: 'Lifecycle Daily', patterns: ['lifecycle'] },
      { name: 'Session Harvester', patterns: ['harvester'] },
      { name: 'Cross-Agent Learning', patterns: ['cross-agent'] },
      { name: 'Contradiction Detector', patterns: ['contradiction'] }
    ];

    let found = 0;
    let enabled = 0;
    const missing = [];

    for (const expected of keywords) {
      const match = jobs.find(j => {
        const combined = normalize(j);
        return expected.patterns.some(p => combined.includes(p));
      });
      if (match) {
        found++;
        if (match.enabled) enabled++;
      } else {
        missing.push(expected.name);
      }
    }

    const detail = `${found}/6 legacy component jobs registered, ${enabled} enabled` + (missing.length > 0 ? ` (missing: ${missing.join(', ')})` : '');

    if (found >= 5 && enabled >= 5) return { status: 'ok', label: 'Cron jobs', detail };
    if (missing.length >= 3) return { status: 'fail', label: 'Cron jobs', detail };
    return { status: 'warn', label: 'Cron jobs', detail };
  } catch (err) {
    return { status: 'warn', label: 'Cron jobs', detail: 'cannot read cron config' };
  }
}

async function checkLastMemory(db) {
  try {
    const res = await db.query(
      `SELECT created_at FROM brainx_memories ORDER BY created_at DESC LIMIT 1`
    );
    if (res.rows.length === 0) {
      return { status: 'fail', label: 'Last memory', detail: 'no memories found' };
    }
    const lastAt = new Date(res.rows[0].created_at);
    const hoursAgo = (Date.now() - lastAt.getTime()) / (1000 * 60 * 60);

    let detail;
    if (hoursAgo < 48) {
      detail = `last: ${Math.round(hoursAgo)}h ago`;
    } else {
      detail = `last: ${Math.round(hoursAgo / 24)} days ago`;
    }

    if (hoursAgo < 24) return { status: 'ok', label: 'Last memory', detail };
    if (hoursAgo < 72) return { status: 'warn', label: 'Last memory', detail };
    return { status: 'fail', label: 'Last memory', detail };
  } catch (err) {
    return { status: 'fail', label: 'Last memory', detail: err.message };
  }
}

async function checkEmbeddingDimensions(db) {
  try {
    const res = await db.query(
      `SELECT DISTINCT array_length(embedding::real[], 1) AS dim
       FROM brainx_memories
       WHERE embedding IS NOT NULL
       LIMIT 10`
    );
    if (res.rows.length === 0) {
      return { status: 'ok', label: 'Embedding dims', detail: 'no embeddings to check' };
    }
    const dims = res.rows.map(r => r.dim).filter(d => d != null);
    if (dims.length === 0) {
      return { status: 'ok', label: 'Embedding dims', detail: 'no dimensions detected' };
    }
    if (dims.length === 1) {
      return { status: 'ok', label: 'Embedding dims', detail: `uniform: ${dims[0]}d` };
    }
    return { status: 'warn', label: 'Embedding dims', detail: `mixed: ${dims.map(d => d + 'd').join(', ')}` };
  } catch (err) {
    return { status: 'fail', label: 'Embedding dims', detail: err.message };
  }
}

function checkBackupFreshness() {
  const backupDirs = [
    path.join(OPENCLAW_HOME, 'skills', 'brainx', 'backups') + path.sep,
    path.join(process.env.HOME || '', 'backups') + path.sep
  ];
  const extensions = ['.sql', '.dump', '.pg_dump'];

  let newestMtime = null;
  let newestFile = null;

  for (const dir of backupDirs) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const ext = path.extname(entry.name);
        if (!extensions.includes(ext)) continue;
        const fullPath = path.join(entry.parentPath || entry.path || dir, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (!newestMtime || stat.mtime > newestMtime) {
            newestMtime = stat.mtime;
            newestFile = fullPath;
          }
        } catch (_) { /* skip inaccessible files */ }
      }
    } catch (_) { /* dir doesn't exist */ }
  }

  if (!newestMtime) {
    return { status: 'warn', label: 'Backup freshness', detail: 'no backup files found' };
  }

  const daysAgo = (Date.now() - newestMtime.getTime()) / (1000 * 60 * 60 * 24);
  const detail = `${Math.round(daysAgo)}d ago (${path.basename(newestFile)})`;

  if (daysAgo < 7) return { status: 'ok', label: 'Backup freshness', detail };
  if (daysAgo < 30) return { status: 'warn', label: 'Backup freshness', detail };
  return { status: 'fail', label: 'Backup freshness', detail };
}

// ─── Run all checks ───

async function runAllChecks(db, options = {}) {
  const fullMode = options.full === true;
  const database = [];
  database.push(await checkDbConnection(db));
  if (database[0].status === 'fail') {
    return {
      fullMode,
      database,
      schema: [],
      integrity: [],
      provenance: [],
      surfaces: [],
      distribution: {},
      telemetry: {},
      infra: [],
      functional: [],
      passed: 0,
      warnings: 0,
      failures: 1
    };
  }
  database.push(await checkPgvector(db));
  database.push(await checkTables(db));

  const schema = [];
  schema.push(await checkFeatureTables(db));
  schema.push(await checkSchemaColumns(db));
  schema.push(await checkSchemaConstraints(db));
  schema.push(await checkIndexes(db));
  schema.push(await checkSchemaVersion(db));

  const integrity = [];
  integrity.push(await checkOrphanedRefs(db));
  integrity.push(await checkNullEmbeddings(db));
  integrity.push(await checkExpiredMemories(db));
  integrity.push(await checkSensitivityCalibration(db));
  integrity.push(await checkStaleMemories(db));
  integrity.push(await checkLastMemory(db));
  integrity.push(await checkEmbeddingDimensions(db));

  const provenance = [];
  provenance.push(await checkLegacyProvenance(db));
  provenance.push(await checkDuplicateCandidates(db));

  const surfaces = [];
  surfaces.push(await checkLearningDetailsFreshness(db));
  surfaces.push(await checkSessionSnapshotsFreshness(db));
  surfaces.push(await checkTrajectoriesFreshness(db));

  const tierDist = await checkTierDistribution(db);
  const typeDist = await checkTypeDistribution(db);
  const totalMem = await checkTotalMemories(db);

  const infra = [];
  infra.push(checkHookStatus());
  infra.push(checkLiveCaptureHookStatus());
  infra.push(checkCliAvailable());
  infra.push(checkFeatureFiles());
  infra.push(await checkBrainxWikiStatus());
  infra.push(await checkBrainxWikiLint());
  infra.push(await checkObsidianSupport());
  infra.push(checkManagedHookSync());
  infra.push(checkRuntimeRouteGovernance());
  infra.push(await checkWorkingMemoryHygiene());
  infra.push(checkCommandResolution());
  infra.push(checkEmbeddingEnv());
  infra.push(checkCommandSurface());
  infra.push(checkSurfacePolicyRegistry());
  infra.push(checkPromotionSink());
  infra.push(await checkPromotionSuggestionQueue(db));
  infra.push(await checkPromotionSuggestionDrift(db));
  infra.push(checkCronJobs());
  infra.push(checkBackupFreshness());
  infra.push(await checkScaleReadiness(db));
  infra.push(await checkAdvisoryFeedbackLoop(db));
  infra.push(await checkEidosAdoption(db));
  const liveCaptureTelemetry = checkLiveCaptureTelemetry();
  infra.push(liveCaptureTelemetry);

  const functional = runFunctionalChecks(fullMode);
  if (fullMode) {
    functional.push(await runWritableRoundTripCheck(db));
  }

  const all = [...database, ...schema, ...integrity, ...provenance, ...surfaces, ...infra, ...functional];
  const passed = all.filter(r => r.status === 'ok').length;
  const warnings = all.filter(r => r.status === 'warn').length;
  const failures = all.filter(r => r.status === 'fail').length;

  return {
    fullMode,
    database,
    schema,
    integrity,
    provenance,
    surfaces,
    distribution: { tiers: tierDist, types: typeDist, total: totalMem },
    telemetry: {
      live_capture: liveCaptureTelemetry.telemetry || null
    },
    infra,
    functional,
    passed,
    warnings,
    failures
  };
}

// ─── Unicode box formatting (clack style) ───

const BANNER = `
 ██████╗ ██████╗  █████╗ ██╗███╗   ██╗██╗  ██╗
 ██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║╚██╗██╔╝
 ██████╔╝██████╔╝███████║██║██╔██╗ ██║ ╚███╔╝
 ██╔══██╗██╔══██╗██╔══██║██║██║╚██╗██║ ██╔██╗
 ██████╔╝██║  ██║██║  ██║██║██║ ╚████║██╔╝ ██╗
 ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝`;

const SYM = { ok: '✓', warn: '⚠', fail: '✗' };

function dotLine(label, detail, maxLabelLen) {
  const pad = maxLabelLen - label.length;
  const dots = ' ' + '.'.repeat(Math.max(1, pad + 2)) + ' ';
  return `${label}${dots}${detail}`;
}

function buildSection(title, checks, verbose, W) {
  const maxLabel = Math.max(...checks.map(c => c.label.length), 10);

  // Pre-compute all content lines to find actual max width
  const contentLines = [];
  for (const c of checks) {
    const sym = SYM[c.status] || ' ';
    const prefix = c.status === 'info' ? ' ' : `${sym}`;
    const text = dotLine(c.label, c.detail, maxLabel);
    contentLines.push({ line: `  ${prefix} ${text}`, check: c });
  }

  // Effective width = max of W and longest line
  const maxLine = Math.max(W, ...contentLines.map(cl => cl.line.length + 2));

  const titleBar = `◇  ${title} ` + '─'.repeat(Math.max(1, maxLine - title.length - 4)) + '╮';
  const lines = [];
  lines.push(`│`);
  lines.push(titleBar);
  lines.push(`│${' '.repeat(maxLine + 1)}│`);

  for (const cl of contentLines) {
    const pad = maxLine - cl.line.length;
    lines.push(`│${cl.line}${' '.repeat(Math.max(1, pad + 1))}│`);
    if (verbose && cl.check.verbose) {
      for (const v of cl.check.verbose) {
        const vl = `      ${v}`;
        lines.push(`│${vl}${' '.repeat(Math.max(1, maxLine - vl.length + 1))}│`);
      }
    }
  }
  lines.push(`│${' '.repeat(maxLine + 1)}│`);
  lines.push(`├${'─'.repeat(maxLine + 1)}╯`);

  return lines;
}

function buildDistributionSection(distribution, W) {
  // Pre-compute all content lines to find max width
  const contentLines = [];

  if (distribution.tiers && Array.isArray(distribution.tiers.detail)) {
    const tierStr = distribution.tiers.detail.map(r => `${r.tier}:${r.cnt}`).join('  ');
    contentLines.push(`  Tiers: ${tierStr}`);
  }

  if (distribution.types && Array.isArray(distribution.types.detail)) {
    const parts = distribution.types.detail.map(r => `${r.type}:${r.cnt}`);
    // Split into rows of 4 to keep lines short
    for (let i = 0; i < parts.length; i += 4) {
      const chunk = parts.slice(i, i + 4).join('  ');
      const prefix = i === 0 ? '  Types: ' : '         ';
      contentLines.push(`${prefix}${chunk}`);
    }
  }

  if (distribution.total) {
    contentLines.push(`  Total active: ${distribution.total.detail}`);
  }

  const maxLine = Math.max(W, ...contentLines.map(l => l.length + 2));

  const titleBar = `◇  Distribution ` + '─'.repeat(Math.max(1, maxLine - 16)) + '╮';
  const lines = [];
  lines.push(`│`);
  lines.push(titleBar);
  lines.push(`│${' '.repeat(maxLine + 1)}│`);

  for (const cl of contentLines) {
    const pad = maxLine - cl.length;
    lines.push(`│${cl}${' '.repeat(Math.max(1, pad + 1))}│`);
  }

  lines.push(`│${' '.repeat(maxLine + 1)}│`);
  lines.push(`├${'─'.repeat(maxLine + 1)}╯`);

  return lines;
}

function formatReport(report, verbose = false) {
  const W = 58; // inner content width
  const out = [];

  out.push(BANNER);
  out.push('                    🧠 DOCTOR 🧠');
  out.push('');
  out.push('┌  BrainX Doctor');

  // Database section
  out.push(...buildSection('Database', report.database, verbose, W));

  // Schema section
  if (report.schema.length) {
    out.push(...buildSection('Schema', report.schema, verbose, W));
  }

  // Data Integrity section
  if (report.integrity.length) {
    out.push(...buildSection('Data Integrity', report.integrity, verbose, W));
  }

  // Provenance section
  if (report.provenance.length) {
    out.push(...buildSection('Provenance', report.provenance, verbose, W));
  }

  if (report.surfaces?.length) {
    out.push(...buildSection('Surface Freshness', report.surfaces, verbose, W));
  }

  // Distribution section
  if (report.distribution) {
    out.push(...buildDistributionSection(report.distribution, W));
  }

  // Infrastructure section
  if (report.infra.length) {
    out.push(...buildSection('Infrastructure', report.infra, verbose, W));
  }

  if (report.functional?.length) {
    out.push(...buildSection('Functional', report.functional, verbose, W));
  }

  // Footer
  out.push('│');

  const parts = [];
  if (report.fullMode) parts.push('full mode');
  if (report.passed > 0) parts.push(`${report.passed} passed`);
  if (report.warnings > 0) parts.push(`${report.warnings} warnings`);
  if (report.failures > 0) parts.push(`${report.failures} failures`);
  out.push(`└  Done — ${parts.join(', ')}`);

  if (report.failures > 0 || report.warnings > 0) {
    out.push(`   Run \`brainx --fix\` to auto-repair.`);
  }

  return out.join('\n');
}

function formatReportJson(report) {
  const allChecks = [...report.database, ...report.schema, ...report.integrity, ...report.provenance, ...(report.surfaces || []), ...report.infra, ...(report.functional || [])];

  // Include distribution data
  const dist = {};
  if (report.distribution) {
    if (report.distribution.tiers && Array.isArray(report.distribution.tiers.detail)) {
      dist.tiers = report.distribution.tiers.detail;
    }
    if (report.distribution.types && Array.isArray(report.distribution.types.detail)) {
      dist.types = report.distribution.types.detail;
    }
    if (report.distribution.total) {
      dist.total_active = report.distribution.total.detail;
    }
  }

  const telemetry = {};
  if (report.telemetry?.live_capture) {
    telemetry.live_capture = report.telemetry.live_capture;
  }

  return JSON.stringify({
    ok: report.failures === 0,
    fullMode: report.fullMode === true,
    passed: report.passed,
    warnings: report.warnings,
    failures: report.failures,
    surfaces: (report.surfaces || []).map((r) => ({
      label: r.label,
      status: r.status,
      detail: r.detail,
      verbose: r.verbose || null
    })),
    checks: allChecks.map(r => ({
      label: r.label,
      status: r.status,
      detail: r.detail,
      verbose: r.verbose || null
    })),
    distribution: dist,
    telemetry
  }, null, 2);
}

// ─── Main entry point ───

async function cmdDoctor(args, deps = {}) {
  let db;
  try {
    db = deps.db || require('./db');
  } catch (err) {
    console.log(BANNER);
    console.log('                    🧠 DOCTOR 🧠');
    console.log('');
    console.log('┌  BrainX Doctor');
    console.log('│');
    console.log('└  ✗ Database connection failed: ' + err.message);
    return;
  }

  const report = await runAllChecks(db, { full: args.full === true });

  if (args.json) {
    console.log(formatReportJson(report));
  } else {
    console.log(formatReport(report, args.verbose || false));
  }
}

module.exports = {
  runAllChecks,
  formatReport,
  formatReportJson,
  cmdDoctor,
  EXPECTED_COLUMNS,
  EXPECTED_CONSTRAINTS,
  EXPECTED_INDEXES,
  inferWrapperStepSchedule,
  buildSurfaceFreshnessCheck,
  getSurfaceFreshnessThresholds,
  normalizeSurfacePolicyState,
  getSurfacePolicy
};
