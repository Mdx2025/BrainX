#!/usr/bin/env node
// Degrade memories that BrainX injected repeatedly without any agent referencing
// them back — "signal without uptake".
//
// Why this exists (non-obvious invariants):
// - BrainX tracks every injection in brainx_runtime_injections: which memories
//   were selected (memory_ids[]) and which the agent response actually picked
//   up (referenced_ids[]). This is ground truth for "did the injection help".
// - Memories that match many prompts but never get referenced are generic
//   enough to leak across queries without adding signal. Left untouched they
//   dominate recall and drown out specific memories.
// - We do not delete or mark obsolete — a generic memory may still be
//   correct, just too broad. We move it down one tier and tag it so future
//   runs can follow the trajectory. Reversible by design.
//
// Usage:
//   node scripts/degrade-over-injected.js                 # dry-run, default thresholds
//   node scripts/degrade-over-injected.js --apply         # write changes
//   node scripts/degrade-over-injected.js --window 14     # 14d window
//   node scripts/degrade-over-injected.js --min 10 --apply
//   node scripts/degrade-over-injected.js --json
//
// Emits on stdout:
//   - Human summary (unless --json)
//   - BRAINX_LOG: and BRAINX_CLOSEOUT_EVIDENCE: lines for the daily core
//     wrapper's harvester.

'use strict';

const { query } = require('../lib/db.js');

function parseArgs(argv) {
  const out = { apply: false, windowDays: 7, minInjections: 20, maxReferenced: 0, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--json') out.json = true;
    else if (a === '--window') out.windowDays = parseInt(argv[++i], 10);
    else if (a === '--min') out.minInjections = parseInt(argv[++i], 10);
    else if (a === '--max-ref') out.maxReferenced = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/degrade-over-injected.js [--apply] [--window N] [--min N] [--max-ref N] [--json]');
      process.exit(0);
    }
  }
  if (!Number.isFinite(out.windowDays) || out.windowDays <= 0) out.windowDays = 7;
  if (!Number.isFinite(out.minInjections) || out.minInjections <= 0) out.minInjections = 20;
  if (!Number.isFinite(out.maxReferenced) || out.maxReferenced < 0) out.maxReferenced = 0;
  return out;
}

// Tier descent ladder. Stops at `archive` — never removes the row.
const TIER_STEP = { hot: 'warm', warm: 'cold', cold: 'archive', archive: 'archive' };

async function findCandidates(cfg) {
  const r = await query(
    `
    WITH per_mem AS (
      SELECT mid,
        COUNT(*)::int AS times_injected,
        SUM(CASE WHEN mid = ANY(ri.referenced_ids) THEN 1 ELSE 0 END)::int AS times_referenced,
        COUNT(DISTINCT ri.agent)::int AS distinct_agents,
        MAX(ri.injected_at) AS last_injected
      FROM brainx_runtime_injections ri,
           LATERAL unnest(ri.memory_ids) mid
      WHERE ri.injected_at > NOW() - ($1::int || ' days')::interval
      GROUP BY mid
    )
    SELECT p.mid AS id, p.times_injected, p.times_referenced, p.distinct_agents, p.last_injected,
           m.type, m.tier, m.importance, m.verification_state, m.tags,
           LEFT(m.content, 200) AS preview
    FROM per_mem p
    JOIN brainx_memories m ON m.id = p.mid
    WHERE p.times_injected >= $2::int
      AND p.times_referenced <= $3::int
    ORDER BY p.times_injected DESC
    `,
    [cfg.windowDays, cfg.minInjections, cfg.maxReferenced],
  );
  return r.rows;
}

function nextTier(current) {
  const normalized = String(current || '').toLowerCase();
  return TIER_STEP[normalized] || null;
}

function buildNoiseTag(candidate, today) {
  return `noise:over-injected:${today}:w${candidate.times_injected}`;
}

async function applyDegrade(candidate, today) {
  const nextT = nextTier(candidate.tier);
  if (!nextT) return { skipped: 'no_next_tier' };
  const tag = buildNoiseTag(candidate, today);
  const existingTags = Array.isArray(candidate.tags) ? candidate.tags : [];
  const nextTags = existingTags.includes(tag) ? existingTags : [...existingTags, tag];
  await query(
    `UPDATE brainx_memories SET tier = $1, tags = $2 WHERE id = $3`,
    [nextT, nextTags, candidate.id],
  );
  return { fromTier: candidate.tier, toTier: nextT, addedTag: tag };
}

function summarizeCandidate(c, action) {
  return {
    id: c.id,
    type: c.type,
    importance: c.importance,
    verification_state: c.verification_state,
    distinct_agents: c.distinct_agents,
    times_injected: c.times_injected,
    times_referenced: c.times_referenced,
    preview: c.preview,
    action,
  };
}

async function main() {
  const cfg = parseArgs(process.argv);
  const today = new Date().toISOString().slice(0, 10);
  const candidates = await findCandidates(cfg);

  const applied = [];
  const skipped = [];

  if (cfg.apply) {
    for (const c of candidates) {
      try {
        const result = await applyDegrade(c, today);
        if (result.skipped) skipped.push(summarizeCandidate(c, result));
        else applied.push(summarizeCandidate(c, result));
      } catch (err) {
        skipped.push(summarizeCandidate(c, { error: String(err?.message || err) }));
      }
    }
  }

  const report = {
    ok: true,
    mode: cfg.apply ? 'apply' : 'dry-run',
    window_days: cfg.windowDays,
    min_injections: cfg.minInjections,
    max_referenced: cfg.maxReferenced,
    today,
    candidates_found: candidates.length,
    applied_count: applied.length,
    skipped_count: skipped.length,
    candidates: cfg.apply ? null : candidates.map((c) => summarizeCandidate(c, null)),
    applied,
    skipped,
  };

  if (cfg.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[degrade-over-injected] mode=${report.mode} window=${cfg.windowDays}d min_inj=${cfg.minInjections} max_ref=${cfg.maxReferenced}`);
    console.log(`[degrade-over-injected] candidates=${candidates.length} applied=${applied.length} skipped=${skipped.length}`);
    for (const c of candidates) {
      const note = cfg.apply
        ? (applied.find((x) => x.id === c.id)?.action
            ? `→ ${applied.find((x) => x.id === c.id).action.fromTier}→${applied.find((x) => x.id === c.id).action.toTier}`
            : 'SKIPPED')
        : 'DRY-RUN';
      console.log(`  ${c.id} inj=${c.times_injected} ref=${c.times_referenced} tier=${c.tier} imp=${c.importance} ${note}`);
    }
  }

  // Daily-core wrapper harvester lines
  console.log(`BRAINX_LOG: degrade_over_injected mode=${report.mode} candidates=${candidates.length} applied=${applied.length}`);
  console.log(`BRAINX_CLOSEOUT_EVIDENCE: degrade_over_injected candidates=${candidates.length} applied=${applied.length} window=${cfg.windowDays}d`);

  process.exit(0);
}

main().catch((err) => {
  console.error('[degrade-over-injected] error:', err?.message || err);
  console.log(`BRAINX_LOG: degrade_over_injected error=${String(err?.message || err).slice(0, 200)}`);
  process.exit(1);
});
