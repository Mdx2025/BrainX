const assert = require('assert');
const cli = require('../lib/cli');
const doctor = require('../lib/doctor');
const fix = require('../lib/fix');
const phase2 = require('../lib/brainx-phase2');
const consolidation = require('../lib/semantic-consolidation');
const promotionGov = require('../lib/promotion-governance');

function makeIo() {
  const logs = [];
  let stdout = '';
  return {
    logs,
    getStdout: () => stdout,
    deps: {
      log: (s) => logs.push(String(s)),
      err: (s) => logs.push(`ERR:${String(s)}`),
      stdout: { write: (s) => { stdout += String(s); } }
    }
  };
}

async function testCmdAddMetadata() {
  const io = makeIo();
  let storedMemory;
  const rag = {
    async storeMemory(memory) {
      storedMemory = memory;
      return { id: 'existing_by_pattern', pattern_key: memory.pattern_key };
    }
  };

  await cli.cmdAdd({
    type: 'learning',
    content: 'Need stricter retry handling',
    context: 'proj',
    tier: 'hot',
    importance: '8',
    tags: 'a,b',
    status: 'in_progress',
    category: 'best_practice',
    patternKey: 'retry.loop',
    recurrenceCount: '3',
    resolutionNotes: 'track in runbook'
  }, { rag, ...io.deps });

  assert.strictEqual(storedMemory.pattern_key, 'retry.loop');
  assert.strictEqual(storedMemory.status, 'in_progress');
  assert.strictEqual(storedMemory.category, 'best_practice');
  assert.strictEqual(storedMemory.recurrence_count, 3);
  assert.deepStrictEqual(storedMemory.tags, ['a', 'b']);

  const payload = JSON.parse(io.logs[0]);
  assert.deepStrictEqual(payload, { ok: true, id: 'existing_by_pattern', pattern_key: 'retry.loop' });
}

async function testCmdSearchContractAndLogging() {
  const io = makeIo();
  const logEvents = [];
  const rag = {
    async search(query, opts) {
      assert.strictEqual(query, 'find memory');
      assert.strictEqual(opts.limit, 5);
      assert.strictEqual(opts.maxSensitivity, 'normal');
      return [
        { id: 'm1', content: 'x', similarity: 0.9, score: 1.1 },
        { id: 'm2', content: 'y', similarity: 0.5, score: 0.6 }
      ];
    },
    async logQueryEvent(evt) {
      logEvents.push(evt);
    }
  };

  await cli.cmdSearch({ query: 'find memory', limit: '5', minSimilarity: '0.2' }, { rag, ...io.deps });

  const payload = JSON.parse(io.logs[0]);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.results.length, 2);
  assert.strictEqual(logEvents.length, 1);
  assert.strictEqual(logEvents[0].kind, 'search');
  assert.strictEqual(logEvents[0].resultsCount, 2);
  assert.ok(logEvents[0].avgSimilarity >= 0.69 && logEvents[0].avgSimilarity <= 0.71);
}

async function testCmdInjectGuardrailsAndLogging() {
  const io = makeIo();
  const calls = [];
  const logEvents = [];
  const rag = {
    async search(query, opts) {
      calls.push({ query, opts });
      assert.strictEqual(opts.maxSensitivity, 'normal');
      if (opts.tierFilter === 'hot') {
        return [
          { id: 'a', similarity: 0.8, score: 0.9, importance: 9, tier: 'hot', type: 'fact', agent: 'coder', context: 'deploy ctx', content: 'deploy config line 1\nline2', verification_state: 'verified', source_kind: 'tool_verified' },
          { id: 'dup', similarity: 0.7, score: 0.4, importance: 6, tier: 'hot', type: 'gotcha', agent: 'coder', context: 'deploy ctx', content: 'duplicate deploy hot', verification_state: 'verified', source_kind: 'user_explicit' }
        ];
      }
      return [
        { id: 'dup', similarity: 0.6, score: 0.5, importance: 6, tier: 'warm', type: 'gotcha', agent: 'coder', context: 'deploy ctx', content: 'duplicate deploy warm', verification_state: 'verified', source_kind: 'user_explicit' },
        { id: 'b', similarity: 0.5, score: 0.2, importance: 5, tier: 'warm', type: 'fact', agent: 'coder', context: 'ctx', content: 'LOW SCORE SHOULD FILTER', verification_state: 'verified', source_kind: 'tool_verified' }
      ];
    },
    async logQueryEvent(evt) {
      logEvents.push(evt);
    }
  };

  await cli.cmdInject({ query: 'deploy config', limit: '5', maxTotalChars: '90', minScore: '0.3' }, { rag, ...io.deps });

  assert.strictEqual(calls.length, 2);
  assert.ok(calls.every(c => c.opts.minSimilarity === 0.28));
  const out = io.getStdout();
  assert.ok(out.includes('deploy config'));
  assert.ok(!out.includes('LOW SCORE SHOULD FILTER'));
  assert.ok(out.length <= 90);
  assert.strictEqual(logEvents.length, 1);
  assert.strictEqual(logEvents[0].kind, 'inject');
  assert.strictEqual(logEvents[0].resultsCount, 2);
}

async function testSensitivityHelpers() {
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Credenciales para login son [REDACTED] y test12345',
      tags: ['pii:redacted', 'pii:email']
    }),
    'restricted'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Bind local [REDACTED]',
      tags: ['pii:redacted', 'pii:ipv4']
    }),
    'sensitive'
  );
  assert.deepStrictEqual(
    phase2.getAllowedSensitivities('sensitive'),
    ['normal', 'sensitive']
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'OAuth login completado para [REDACTED], pero sin tokens reales.',
      tags: ['pii:redacted', 'pii:email']
    }),
    'sensitive'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Credenciales para login son [REDACTED] / test12345',
      tags: ['pii:redacted', 'pii:ipv4']
    }),
    'restricted'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Bridge debe usar un Bearer token real y endpoint HTTPS.',
      tags: ['pii:redacted', 'pii:ipv4']
    }),
    'sensitive'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'El login OAuth con [REDACTED] termina exitoso y guarda credentials.enc, pero no existe token_cache para hello.',
      tags: ['pii:redacted', 'pii:email']
    }),
    'sensitive'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: '- `credentials-admin.json` -> [REDACTED]\n- `credentials-hello.json` -> [REDACTED]',
      tags: ['pii:redacted', 'pii:email']
    }),
    'sensitive'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Las credenciales del proveedor están guardadas con login [REDACTED] y password [REDACTED].',
      tags: ['pii:redacted', 'pii:email']
    }),
    'restricted'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Test user: [REDACTED] / Test1234!',
      tags: ['pii:redacted', 'pii:email']
    }),
    'restricted'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Necesito credenciales del Django admin (username + password) o acceso SSH para desactivar 2FA.',
      tags: ['pii:redacted', 'pii:email']
    }),
    'sensitive'
  );
  assert.strictEqual(
    phase2.deriveSensitivity({
      content: 'Usuario: example-org. Comparte los archivos clave del repo para revisar el error.',
      tags: ['pii:redacted', 'pii:phone']
    }),
    'sensitive'
  );
}

async function testCmdResolveLifecycleUpdate() {
  const io = makeIo();
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/UPDATE brainx_memories/.test(sql)) {
        return {
          rowCount: 1,
          rows: [{ id: 'm1', pattern_key: 'pk1', status: params[1], resolved_at: params[2], promoted_to: params[3], resolution_notes: params[4] }]
        };
      }
      return { rowCount: 1, rows: [] };
    }
  };

  await cli.cmdResolve({ id: 'm1', status: 'resolved', resolutionNotes: 'fixed' }, { db, ...io.deps });

  assert.strictEqual(queries.length, 2);
  assert.ok(/UPDATE brainx_memories/.test(queries[0].sql));
  assert.ok(/UPDATE brainx_patterns/.test(queries[1].sql));
  assert.strictEqual(queries[0].params[0], 'm1');
  assert.strictEqual(queries[0].params[1], 'resolved');
  assert.ok(queries[0].params[2]);
  const payload = JSON.parse(io.logs[0]);
  assert.strictEqual(payload.updated, 1);
}

async function testPromoteCandidatesDefaultsAndJson() {
  const io = makeIo();
  let lastParams;
  const db = {
    async query(sql, params) {
      assert.ok(sql.includes('FROM brainx_patterns'));
      lastParams = params;
      return {
        rows: [
          { pattern_key: 'pk1', recurrence_count: 4, last_status: 'pending', representative_content: 'x' }
        ]
      };
    }
  };

  await cli.cmdPromoteCandidates({}, { db, ...io.deps });

  assert.deepStrictEqual(lastParams, [3, 30, 50]);
  const payload = JSON.parse(io.logs[0]);
  assert.deepStrictEqual(payload.thresholds, { minRecurrence: 3, days: 30 });
  assert.strictEqual(payload.count, 1);
}

async function testMetricsOutput() {
  const io = makeIo();
  let call = 0;
  const db = {
    async query(_sql, _params) {
      call += 1;
      const responses = [
        { rows: [{ key: 'pending', count: 2 }] },
        { rows: [{ key: 'learning', count: 1 }] },
        { rows: [{ key: 'warm', count: 2 }] },
        { rows: [{ pattern_key: 'pk1', recurrence_count: 5 }] },
        { rows: [{ query_kind: 'search', calls: 3, avg_duration_ms: '12.34' }] }
      ];
      return responses[call - 1];
    }
  };

  await cli.cmdMetrics({ days: '14', topPatterns: '5' }, { db, ...io.deps });
  const payload = JSON.parse(io.logs[0]);
  assert.strictEqual(payload.window_days, 14);
  assert.strictEqual(payload.top_recurring_patterns.length, 1);
  assert.strictEqual(payload.query_performance[0].query_kind, 'search');
}

async function testPiiScrubHelpers() {
  const scrubbed = phase2.scrubTextPII(
    'email me at jane@example.com or call (415) 555-1234 with api_key: abcdefghijklmnop',
    { enabled: true, replacement: '[REDACTED]' }
  );
  assert.strictEqual(scrubbed.redacted, true);
  assert.ok(scrubbed.reasons.includes('email'));
  assert.ok(scrubbed.reasons.includes('phone'));
  assert.ok(scrubbed.reasons.some((r) => r.includes('key') || r.includes('openai')));
  assert.ok(!scrubbed.text.includes('jane@example.com'));
  const longId = phase2.scrubTextPII(
    'session id 1480684710010159195 should stay visible',
    { enabled: true, replacement: '[REDACTED]' }
  );
  assert.ok(!longId.reasons.includes('credit_card'));
  assert.ok(longId.text.includes('1480684710010159195'));
  const tags = phase2.mergeTagsWithMetadata(['a'], { redacted: true, reasons: ['email'] });
  assert.deepStrictEqual(tags, ['a', 'pii:redacted', 'pii:email']);
}

async function testSemanticDedupeMergePlanHelper() {
  const now = new Date('2026-02-24T00:00:00.000Z');
  const plan = phase2.deriveMergePlan(
    { id: 'm1', recurrence_count: 2, first_seen: new Date('2026-02-01T00:00:00.000Z'), last_seen: new Date('2026-02-20T00:00:00.000Z') },
    { recurrence_count: null, first_seen: null, last_seen: null },
    now
  );
  assert.strictEqual(plan.found, true);
  assert.strictEqual(plan.finalId, 'm1');
  assert.strictEqual(plan.finalRecurrence, 3);
  assert.strictEqual(plan.finalLastSeen.toISOString(), now.toISOString());
}

async function testPiiAllowlistContextHelper() {
  const cfg = {
    piiScrubEnabled: true,
    piiScrubAllowlistContexts: ['internal-safe', 'trusted']
  };
  assert.strictEqual(phase2.shouldScrubForContext('internal-safe', cfg), false);
  assert.strictEqual(phase2.shouldScrubForContext('other-context', cfg), true);
}

async function testQualityGateSkipsAcknowledgementNoise() {
  const result = phase2.assessMemoryQuality({
    type: 'note',
    content: 'ok, lo reviso',
    importance: 5
  });

  assert.strictEqual(result.action, 'skip');
  assert.strictEqual(result.reason, 'acknowledgement');
}

async function testQualityGateSkipsVaguePlaceholder() {
  const result = phase2.assessMemoryQuality({
    type: 'learning',
    content: 'Need to review this',
    importance: 5
  });

  assert.strictEqual(result.action, 'skip');
  assert.strictEqual(result.reason, 'placeholder');
}

async function testQualityGateKeepsShortTechnicalSignal() {
  const result = phase2.assessMemoryQuality({
    type: 'decision',
    content: 'Use RAILWAY_API_TOKEN for railway whoami.',
    importance: 8
  });

  assert.strictEqual(result.action, 'store');
  assert.ok(result.score >= 2);
}

async function testQualityGateDowngradesBorderlineSignal() {
  const result = phase2.assessMemoryQuality({
    type: 'learning',
    content: 'Need better retries',
    importance: 4
  });

  assert.strictEqual(result.action, 'downgrade');
  assert.strictEqual(result.reason, 'borderline');
  assert.ok(result.tags.includes('quality:borderline'));
}

async function testSemanticConsolidationRejectsRuntimeNoise() {
  const result = consolidation.isMemoryEligibleForConsolidation({
    id: 'm1',
    type: 'decision',
    content: '[Subagent Context] You are running as a subagent (depth 1/2). Results auto-announce to your requester.',
    created_at: '2026-03-01T00:00:00.000Z',
    verification_state: 'verified',
    source_kind: 'agent_inference',
    tags: []
  }, {}, new Date('2026-04-01T00:00:00.000Z'));

  assert.strictEqual(result.eligible, false);
  assert.ok(result.reasons.includes('runtime_noise'));
}

async function testSemanticConsolidationPairScopeGuard() {
  const cfg = consolidation.getSemanticConsolidationConfig();
  const now = new Date('2026-04-01T00:00:00.000Z');
  const left = {
    id: 'a',
    type: 'decision',
    agent: 'reasoning',
    context: 'project:x',
    category: 'infrastructure',
    sensitivity: 'normal',
    content: 'Use the remote gateway directly.',
    created_at: '2026-03-20T00:00:00.000Z',
    verification_state: 'verified',
    source_kind: 'agent_inference',
    tags: []
  };
  const right = {
    ...left,
    id: 'b',
    agent: 'coder'
  };

  const result = consolidation.canConsolidatePair(left, right, cfg, now);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reasons.includes('scope_mismatch'));
}

async function testSemanticConsolidationMergeClusterPreservesDurableMetadata() {
  const merged = consolidation.mergeClusterMemories([
    {
      id: 'a',
      type: 'decision',
      agent: 'reasoning',
      context: 'project:x',
      category: 'infrastructure',
      sensitivity: 'normal',
      content: 'Use the remote OpenClaw Gateway over HTTP with a real Bearer token.',
      importance: 9,
      recurrence_count: 1,
      tags: ['distilled'],
      verification_state: 'verified',
      created_at: '2026-03-20T00:00:00.000Z',
      first_seen: '2026-03-20T00:00:00.000Z',
      last_seen: '2026-03-20T00:00:00.000Z',
      last_accessed: '2026-03-21T00:00:00.000Z'
    },
    {
      id: 'b',
      type: 'decision',
      agent: 'reasoning',
      context: 'project:x',
      category: 'infrastructure',
      sensitivity: 'normal',
      content: 'Rebuild the VSIX so it no longer depends on the local bridge.',
      importance: 8,
      recurrence_count: 2,
      tags: ['calibrated_verified'],
      verification_state: 'verified',
      created_at: '2026-03-21T00:00:00.000Z',
      first_seen: '2026-03-21T00:00:00.000Z',
      last_seen: '2026-03-22T00:00:00.000Z',
      last_accessed: '2026-03-23T00:00:00.000Z'
    }
  ]);

  assert.strictEqual(merged.type, 'decision');
  assert.strictEqual(merged.verification_state, 'verified');
  assert.strictEqual(merged.recurrence_count, 3);
  assert.ok(merged.tags.includes('consolidated:weekly'));
  assert.ok(merged.content.includes('VSIX'));
}

async function testSemanticConsolidationMergeClusterDemotesCarriedStaleTier() {
  const merged = consolidation.mergeClusterMemories([
    {
      id: 'a',
      type: 'decision',
      agent: 'writer',
      context: 'project:y',
      category: 'infrastructure',
      sensitivity: 'normal',
      content: 'Use the Telegram attachment workflow that was validated in February.',
      importance: 8,
      recurrence_count: 1,
      access_count: 0,
      tier: 'hot',
      tags: ['distilled'],
      verification_state: 'verified',
      created_at: '2026-03-20T00:00:00.000Z',
      first_seen: '2026-02-20T00:00:00.000Z',
      last_seen: '2026-02-27T00:00:00.000Z',
      last_accessed: '2026-02-27T00:00:00.000Z'
    },
    {
      id: 'b',
      type: 'decision',
      agent: 'writer',
      context: 'project:y',
      category: 'infrastructure',
      sensitivity: 'normal',
      content: 'Keep media handling conservative and avoid duplicate uploads.',
      importance: 7,
      recurrence_count: 1,
      access_count: 0,
      tier: 'hot',
      tags: ['calibrated_verified'],
      verification_state: 'verified',
      created_at: '2026-03-21T00:00:00.000Z',
      first_seen: '2026-02-21T00:00:00.000Z',
      last_seen: '2026-02-28T00:00:00.000Z',
      last_accessed: '2026-02-28T00:00:00.000Z'
    }
  ], { now: '2026-04-02T00:00:00.000Z' });

  assert.strictEqual(merged.tier, 'cold');
  assert.ok(merged.tags.includes('carried_stale_demoted'));
}

async function testWeeklyConsolidationScheduleGuard() {
  assert.strictEqual(
    consolidation.shouldRunWeeklyConsolidation(new Date('2026-04-05T00:00:00.000Z')),
    true
  );
  assert.strictEqual(
    consolidation.shouldRunWeeklyConsolidation(new Date('2026-04-01T00:00:00.000Z')),
    false
  );
}

async function testLifecycleRunPromoteDegradeAndPatternSync() {
  const io = makeIo();
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [{ id: 'p1' }] }; // promote preview
      if (calls.length === 2) return { rows: [{ id: 'd1' }] }; // degrade preview
      if (/UPDATE brainx_memories/.test(sql) && sql.includes("SET status = 'promoted'")) {
        return { rowCount: 1, rows: [{ id: 'p1', pattern_key: 'pk1', status: 'promoted' }] };
      }
      if (/UPDATE brainx_memories/.test(sql) && sql.includes("COALESCE(importance, 5) <= $2")) {
        return { rowCount: 1, rows: [{ id: 'd1', pattern_key: 'pk1', status: 'wont_fix' }] };
      }
      if (/UPDATE brainx_patterns/.test(sql)) {
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    }
  };

  await cli.cmdLifecycleRun({}, { db, ...io.deps });

  assert.ok(calls.some((c) => /UPDATE brainx_memories/.test(c.sql) && c.sql.includes("SET status = 'promoted'")));
  assert.ok(calls.some((c) => /UPDATE brainx_memories/.test(c.sql) && c.sql.includes("COALESCE(importance, 5) <= $2")));
  assert.ok(calls.some((c) => /UPDATE brainx_patterns/.test(c.sql)));
  const payload = JSON.parse(io.logs[0]);
  assert.strictEqual(payload.updated.promoted, 1);
  assert.strictEqual(payload.updated.degraded, 1);
}

async function testDoctorWrapperScheduleInference() {
  const wrapperSource = `
NAMES+=("context-pack-builder")
CMDS+=("timeout 120 node scripts/context-pack-builder.js --days 7")

# ── WEEKLY STEPS (run only on Sundays) ─────────────────────────
if [ "$IS_SUNDAY" -eq 1 ]; then
  NAMES+=("contradiction-detector")
  CMDS+=("timeout 240 node scripts/contradiction-detector.js --top 60 --threshold 0.85")
fi
`;

  assert.strictEqual(
    doctor.inferWrapperStepSchedule(wrapperSource, 'scripts/context-pack-builder.js'),
    'daily'
  );
  assert.strictEqual(
    doctor.inferWrapperStepSchedule(wrapperSource, 'scripts/contradiction-detector.js'),
    'sunday'
  );
  assert.strictEqual(
    doctor.inferWrapperStepSchedule(wrapperSource, 'scripts/learning-detail-extractor.js'),
    'off'
  );
}

async function testDoctorSurfaceFreshnessClassification() {
  const staleOff = doctor.buildSurfaceFreshnessCheck({
    label: 'Learning details freshness',
    table: 'brainx_learning_details',
    total: 110,
    lastAt: '2026-03-09T03:02:39.693Z',
    schedule: 'off',
    nowMs: Date.parse('2026-04-13T00:00:00.000Z')
  });
  assert.strictEqual(staleOff.status, 'warn');
  assert.ok(staleOff.detail.includes('schedule=off'));

  const staleRecentOff = doctor.buildSurfaceFreshnessCheck({
    label: 'Synthetic off freshness',
    table: 'brainx_synthetic_off',
    total: 4,
    lastAt: '2026-04-02T00:00:00.000Z',
    schedule: 'off',
    nowMs: Date.parse('2026-04-13T00:00:00.000Z')
  });
  assert.strictEqual(staleRecentOff.status, 'warn');

  const staleDaily = doctor.buildSurfaceFreshnessCheck({
    label: 'Synthetic daily freshness',
    table: 'brainx_synthetic_daily',
    total: 3,
    lastAt: '2026-04-01T00:00:00.000Z',
    schedule: 'daily',
    nowMs: Date.parse('2026-04-13T00:00:00.000Z')
  });
  assert.strictEqual(staleDaily.status, 'fail');

  const freshSunday = doctor.buildSurfaceFreshnessCheck({
    label: 'Synthetic sunday freshness',
    table: 'brainx_synthetic_sunday',
    total: 4,
    lastAt: '2026-04-10T00:00:00.000Z',
    schedule: 'sunday',
    nowMs: Date.parse('2026-04-13T00:00:00.000Z')
  });
  assert.strictEqual(freshSunday.status, 'ok');

  const dormantOff = doctor.buildSurfaceFreshnessCheck({
    surfaceKey: 'learning_details',
    label: 'Learning details freshness',
    table: 'brainx_learning_details',
    total: 110,
    lastAt: '2026-03-09T03:02:39.693Z',
    schedule: 'off',
    policy: {
      state: 'dormant',
      owner: 'skill',
      expectedSchedule: 'off',
      note: 'intentionally unscheduled'
    },
    nowMs: Date.parse('2026-04-13T00:00:00.000Z')
  });
  assert.strictEqual(dormantOff.status, 'ok');
  assert.ok(dormantOff.detail.includes('policy=dormant'));

  const manualMismatch = doctor.buildSurfaceFreshnessCheck({
    surfaceKey: 'session_snapshots',
    label: 'Session snapshots freshness',
    table: 'brainx_session_snapshots',
    total: 4,
    lastAt: '2026-04-10T00:00:00.000Z',
    schedule: 'daily',
    policy: {
      state: 'manual',
      owner: 'skill',
      expectedSchedule: 'off',
      note: 'manual only'
    },
    nowMs: Date.parse('2026-04-13T00:00:00.000Z')
  });
  assert.strictEqual(manualMismatch.status, 'warn');
  assert.ok(manualMismatch.detail.includes('expected_schedule=off'));
}

async function testFixOnlyStepParsing() {
  assert.deepStrictEqual(
    fix.parseOnlySteps('stale-demotion, null-embeddings'),
    ['stale-demotion', 'null-embeddings']
  );
  assert.strictEqual(fix.parseOnlySteps(''), null);
}

async function testFixOnlyStepResolution() {
  const selected = fix.resolveFixSteps(['stale-demotion', 'null-embeddings']);
  assert.deepStrictEqual(
    selected.steps.map((entry) => entry.id),
    ['stale-demotion', 'null-embeddings']
  );
  assert.deepStrictEqual(selected.unknown, []);

  const withUnknown = fix.resolveFixSteps(['stale-demotion', 'nope']);
  assert.deepStrictEqual(withUnknown.steps.map((entry) => entry.id), ['stale-demotion']);
  assert.deepStrictEqual(withUnknown.unknown, ['nope']);
}

async function testPromotionGovernanceHelpers() {
  const meta = promotionGov.extractSuggestionMetadata(
    '[PROMOTION SUGGESTION] → workflow\nSection: Workflow & Execution\nRule: Usar brainx search antes de concluir que falta contexto\nReason: Workflow/execution pattern\nRecurrence: 4x\nSource: pattern (brainx-search-context)'
  );
  assert.strictEqual(meta.targetKey, 'workflow');
  assert.strictEqual(meta.sourcePatternKey, 'brainx-search-context');
  assert.strictEqual(meta.rule, 'Usar brainx search antes de concluir que falta contexto');

  assert.strictEqual(promotionGov.isLowSignalPromotionRule('[PROMOTION SUGGESTION] → AGENTS'), true);
  assert.strictEqual(promotionGov.isLowSignalPromotionRule('El archivo BRAINX_CONTEXT'), true);
  assert.strictEqual(
    promotionGov.isLowSignalPromotionRule('Si falta contexto o hay conflicto, usar brainx search antes de concluir que no existe memoria relevante'),
    false
  );

  const canonical = {
    sections: {
      workflow: {
        rules: ['- Si falta contexto o hay conflicto, usar brainx search antes de concluir que no existe memoria relevante.'],
        normalizedRules: ['si falta contexto o hay conflicto, usar brainx search antes de concluir que no existe memoria relevante.'],
      },
      tools: { rules: [], normalizedRules: [] },
      behavior: { rules: [], normalizedRules: [] },
    },
  };
  const match = promotionGov.findCanonicalRuleMatch(
    'Si falta contexto o hay conflicto, usar brainx search antes de concluir que no existe memoria relevante.',
    canonical,
    'workflow'
  );
  assert.strictEqual(match.targetKey, 'workflow');
}

async function run() {
  const tests = [
    testCmdAddMetadata,
    testCmdSearchContractAndLogging,
    testCmdInjectGuardrailsAndLogging,
    testCmdResolveLifecycleUpdate,
    testPromoteCandidatesDefaultsAndJson,
    testMetricsOutput,
    testPiiScrubHelpers,
    testSensitivityHelpers,
    testSemanticDedupeMergePlanHelper,
    testPiiAllowlistContextHelper,
    testQualityGateSkipsAcknowledgementNoise,
    testQualityGateSkipsVaguePlaceholder,
    testQualityGateKeepsShortTechnicalSignal,
    testQualityGateDowngradesBorderlineSignal,
    testSemanticConsolidationRejectsRuntimeNoise,
    testSemanticConsolidationPairScopeGuard,
    testSemanticConsolidationMergeClusterPreservesDurableMetadata,
    testSemanticConsolidationMergeClusterDemotesCarriedStaleTier,
    testWeeklyConsolidationScheduleGuard,
    testLifecycleRunPromoteDegradeAndPatternSync,
    testDoctorWrapperScheduleInference,
    testDoctorSurfaceFreshnessClassification,
    testFixOnlyStepParsing,
    testFixOnlyStepResolution,
    testPromotionGovernanceHelpers
  ];

  for (const t of tests) {
    await t();
  }

  console.log(`cli-v5 tests: ${tests.length} passed`);
}

run().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
