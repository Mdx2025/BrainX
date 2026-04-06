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
const CLI_PATH = path.join(__dirname, 'cli.js');
const HOOK_PATH = '/home/clawd/.openclaw/hooks/brainx-auto-inject/handler.js';
const HOOK_SOURCE_PATH = path.join(BRAINX_ROOT, 'hook', 'handler.js');
const HOOK_PROFILES_PATH = '/home/clawd/.openclaw/hooks/brainx-auto-inject/agent-profiles.json';
const HOOK_PROFILES_SOURCE_PATH = path.join(BRAINX_ROOT, 'hook', 'agent-profiles.json');
const LIVE_HOOK_PATH = '/home/clawd/.openclaw/hooks/brainx-live-capture/handler.js';
const LIVE_HOOK_SOURCE_PATH = path.join(BRAINX_ROOT, 'hook-live', 'handler.js');

const FEATURE_FILES = [
  'lib/advisory.js',
  'lib/eidos.js',
  'lib/doctor.js',
  'lib/fix.js',
  'lib/live-capture-stats.js',
  'lib/openai-rag.js',
  'lib/embedding-client.js',
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
  'advisory',
  'advisory-feedback',
  'eidos'
];

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
         SELECT id, embedding FROM brainx_memories
         WHERE embedding IS NOT NULL AND superseded_by IS NULL
         ORDER BY created_at DESC LIMIT 100
       )
       SELECT a.id AS id_a, b.id AS id_b,
              1 - (a.embedding <=> b.embedding) AS similarity
       FROM recent a, recent b
       WHERE a.id < b.id AND 1 - (a.embedding <=> b.embedding) > 0.95
       ORDER BY similarity DESC LIMIT 20`
    );
    const count = res.rows.length;
    if (count === 0) return { status: 'ok', label: 'Duplicates', detail: '0 pairs >0.95 in sample' };
    return {
      status: 'warn', label: 'Duplicates',
      detail: `${count} high-similarity pairs in last 100`,
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

function checkLiveCaptureTelemetry() {
  try {
    const summary = summarizeLiveCapture({ days: 7 });
    if (!summary.exists) {
      return {
        status: 'warn',
        label: 'Live capture telemetry',
        detail: 'no telemetry log yet',
        telemetry: summary,
        verbose: [`log: ${summary.logPath}`]
      };
    }

    const day = summary.last_24h || {};
    const failures24h = Number(day.capture_failed || 0) + Number(day.daily_memory_failures || 0) + Number(day.brainx_store_failures || 0);
    const detail = `24h seen=${day.seen || 0} captured=${day.captured || 0} low=${day.low_signal || 0} dup=${day.duplicate || 0} fail=${failures24h} last_success=${formatAgeShort(summary.last_success_at)}`;

    let status = 'ok';
    if (!summary.last_seen_at) {
      status = 'warn';
    } else if ((Date.now() - Date.parse(summary.last_seen_at)) > (72 * 60 * 60 * 1000)) {
      status = 'warn';
    }
    if (failures24h > 0) status = 'warn';

    return {
      status,
      label: 'Live capture telemetry',
      detail,
      telemetry: summary,
      verbose: [
        `log: ${summary.logPath}`,
        `7d seen=${summary.totals.seen} captured=${summary.totals.captured} low=${summary.totals.low_signal} dup=${summary.totals.duplicate} capture_failed=${summary.totals.capture_failed}`,
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
      (output) => output.includes('BrainX V5 health: OK')
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
  const cronJobsPath = '/home/clawd/.openclaw/cron/jobs.json';
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
      const detail = consolidated.enabled
        ? 'consolidated pipeline detected: BrainX Daily Core Pipeline V5 enabled'
        : 'consolidated pipeline detected but disabled: BrainX Daily Core Pipeline V5';
      return {
        status: consolidated.enabled ? 'ok' : 'fail',
        label: 'Cron jobs',
        detail,
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
    '/home/clawd/.openclaw/skills/brainx-v5/backups/',
    '/home/clawd/backups/'
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

  const tierDist = await checkTierDistribution(db);
  const typeDist = await checkTypeDistribution(db);
  const totalMem = await checkTotalMemories(db);

  const infra = [];
  infra.push(checkHookStatus());
  infra.push(checkLiveCaptureHookStatus());
  infra.push(checkCliAvailable());
  infra.push(checkFeatureFiles());
  infra.push(checkManagedHookSync());
  infra.push(checkCommandResolution());
  infra.push(checkEmbeddingEnv());
  infra.push(checkCommandSurface());
  infra.push(checkCronJobs());
  infra.push(checkBackupFreshness());
  infra.push(await checkScaleReadiness(db));
  const liveCaptureTelemetry = checkLiveCaptureTelemetry();
  infra.push(liveCaptureTelemetry);

  const functional = runFunctionalChecks(fullMode);
  if (fullMode) {
    functional.push(await runWritableRoundTripCheck(db));
  }

  const all = [...database, ...schema, ...integrity, ...provenance, ...infra, ...functional];
  const passed = all.filter(r => r.status === 'ok').length;
  const warnings = all.filter(r => r.status === 'warn').length;
  const failures = all.filter(r => r.status === 'fail').length;

  return {
    fullMode,
    database,
    schema,
    integrity,
    provenance,
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
  const allChecks = [...report.database, ...report.schema, ...report.integrity, ...report.provenance, ...report.infra, ...(report.functional || [])];

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
  EXPECTED_INDEXES
};
