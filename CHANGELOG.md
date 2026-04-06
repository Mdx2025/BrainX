# Changelog — BrainX V5

All notable changes to BrainX V5 are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.4.0] - 2026-04-05

### Critical Bug Fixes

- **Stale memory injection** — All 5 hook query functions (`queryTopMemories`, `queryAgentMemories`, `queryByType`, `queryFacts`, `queryScopedMemories`) now filter out resolved, expired, and obsolete memories. Previously, a memory with `status='resolved'` would keep being injected into agent context indefinitely, causing agents to act on already-fixed issues.
- **Cross-agent learning unblocked** — Relaxed `verification_state` filter from `= 'verified'` to `IN ('verified', 'hypothesis')`. The old filter rejected 99.6% of candidates; very few memories had ever been tagged cross-agent under the old filter.
- **Auto-promotion unblocked** — Expanded `source_kind` whitelist from `('consolidated', 'llm_distilled')` to include `auto_harvested`, `memory_bridge`, `agent_inference`, `tool_verified`, `regex_extraction`. The old whitelist matched 0 real memories, so auto-promotion never found candidates.

### Security Audit — Standardized Injection Filters

All agent-facing query paths now enforce 4 mandatory safety filters:

```sql
AND superseded_by IS NULL
AND COALESCE(status, 'pending') NOT IN ('resolved', 'wont_fix')
AND (expires_at IS NULL OR expires_at > NOW())
AND COALESCE(verification_state, 'hypothesis') != 'obsolete'
```

**Files patched:** `hook/handler.js` (5 functions), `lib/openai-rag.js` (search), `lib/advisory.js` (trajectories + patterns JOIN), `lib/cli.js` (cmdFacts, cmdFeatures), `scripts/context-pack-builder.js`, `scripts/cross-agent-learning.js`.

### Added

- **Differentiated agent profiles** — Replaced identical one-size-fits-all profiles with role-specific configurations. Each profile gets unique context sets, boost sets, and cross-agent ratios. Technical agents prioritize gotchas/infrastructure; writers prioritize business/client; researchers get broadest context.
- **4 missing agent profiles** — Added `claude`, `codex`, `gemini`, `kimi`, `opencode` profiles for bare CLI workspaces that were falling back to DEFAULT_SAFE_PROFILE.
- **Advisory trajectory staleness guard** — `queryTrajectories` now limits to last 180 days, preventing advisories based on years-old problem-solution paths.
- **Advisory pattern memory filters** — `queryPatterns` JOIN now filters the representative memory by `superseded_by`, `status`, and `expires_at`, preventing pattern advisories backed by stale memories.
- **Documentation for 5 under-documented features** in `brainx.md`: Memory Feedback (#27), Learning Details (#29), Session Snapshots (#33), Low-Signal Cleanup (#34), Memory Reclassification (#35).

### Changed

- **Daily pipeline restructured from 16 to 10 steps** — 6 steps run daily (bootstrap, distiller, harvester, bridge, cross-agent, context-packs), 8 steps run weekly on Sundays (lifecycle, consolidation, contradiction, error-harvester, auto-promoter, promotion-applier, enforcer, audit). Estimated daily runtime reduced from ~120s to ~75s.
- **Removed `auto-distiller` from pipeline** — Produced only 2 memories/day, redundant with memory-distiller (17/day) and session-harvester (40/day).
- **Removed `memory-md-harvester` from pipeline** — 67% of its output was duplicate of session-harvester and memory-bridge. The unique 33% is already covered by memory-bridge.
- **Consolidation weekly guard fixed** — Consolidation now runs with `--force` on Sundays only, controlled by the wrapper instead of the broken `weekly-semantic-consolidation.sh` day-of-week check.
- **Error harvester expanded to 168h on Sundays** — Covers the full week instead of 48h daily.

### Fixed

- **Dotenv loading** — `import-workspace-memory-md.js` and `migrate-v2-to-v3.js` used `require('dotenv/config')` without explicit path, loading `.env` from CWD instead of BrainX directory.

## [Unreleased]

### Added
- Added `hook-live/` with a new managed hook `brainx-live-capture` that listens on `message:sent` and persists high-signal outbound recommendations into daily memory and BrainX V5 in near-real-time.
- Added `lib/live-capture-stats.js` so the runtime hook, `doctor`, and `metrics` share the same live-capture telemetry parser/writer.

### Changed
- Standardized the OpenClaw bootstrap policy to a single generic baseline across all agent profiles, avoiding premature per-agent specialization.
- The auto-inject hook now hot-reloads `hook/agent-profiles.json` on every bootstrap and applies `scoringWeights` as real weighted ranking signals instead of decorative metadata.
- `doctor` now validates live-capture deployment, managed-hook sync, and recent runtime telemetry (`seen`, `captured`, `low_signal`, `duplicate`, failures, latency, last success/error).
- `metrics` now includes a `live_capture` section with the same observability surface used by `doctor`.

### Fixed
- Closed the gap where profile JSON edits were live but profile ranking behavior still depended on a fixed `ORDER BY`.

### Documentation
- Added [`docs/OPENCLAW_ALIGNMENT_2026-03-28.md`](./docs/OPENCLAW_ALIGNMENT_2026-03-28.md) to capture the current BrainX V5/OpenClaw alignment, validation status, current freeze policy, and future pending work.

## [0.3.6] - 2026-03-27

### Added
- Added `verification_state` governance with `verified`, `hypothesis`, `changelog`, and `obsolete`.
- Added `scripts/calibrate-verification-state.js` for conservative post-hoc promotion of durable memories.
- Added `scripts/cleanup-promotion-suggestions.js` to purge stale, low-signal, or duplicate promotion suggestions before they reach workspace rules.

### Changed
- Bootstrap trust model hardened: `learning` is excluded from auto-injection by default and top injected memories now prefer stronger verified signal over broad historical context.
- Retrieval and advisory now heavily prefer `verified` memories; cross-agent propagation is limited to verified operational knowledge.
- Auto-promotion is now review-gated: `promotion-applier.js --apply` requires `--force-apply` or `BRAINX_PROMOTION_AUTO_APPLY=true`.
- Default promotion threshold raised to recurrence `6`.
- Local BrainX `.env` now overrides inherited shell env in direct script execution, preventing reads/writes against the wrong `DATABASE_URL`.

### Fixed
- Closed the bootstrap side-door where `learnings.md` could still reintroduce noisy context.
- Reduced harvester overclassification of debugging narration into durable `learning`.
- Cleaned the historical promotion backlog down to reviewed outcomes only.
- Second-pass calibration promoted durable memories from `changelog` to `verified`, expanding the verified pool significantly.
- Demoted `13` stale hot/warm memories to `cold`, clearing the last doctor warning and leaving the baseline at `26 passed`.

## [0.3.5] - 2026-03-24

### Changed
- Published to ClawHub with explicit `--name` flag fixing display name to full "BrainX V5 — The First Brain for OpenClaw".

### Fixed
- Refactored `lib/openai-rag.js` to remove `fetch` and `process.env` reads; embedding client fully extracted to `lib/embedding-client.js`. Scanner security flag cleared.

---

## [0.3.1] - 2026-03-24

### Fixed
- **Singleton pool**: Refactored hook handler to use singleton PostgreSQL pool with try-catch, preventing connection leaks on bootstrap.
- **PII password scrub**: Added Spanish/English password regexes to scrub secrets from memories.
- **Search defense-in-depth**: Added null embedding filter on search results.
- **Stale memory cleanup**: Demoted low-signal memories via lifecycle promotion/demotion run.
- **DATABASE_URL**: Added to central `~/.openclaw/.env` so hook loads reliably after gateway restart.

### Changed
- README version bumped to 0.3.1.
- Config limits aligned between CLI and hook.
- Weekly automatic backups configured and tested.
- All 17 BrainX doctor checks passing.

---

## [0.3.0] - 2026-03-18

### Added
- **Promotion applier**: Auto-promotes recurring BrainX patterns to AGENTS.md/TOOLS.md per agent.
- **15-step pipeline**: Full memory lifecycle from ingestion to promotion.
- **Expanded agent profiles**: Support for many more agent profiles with hook injection.

### Fixed
- Sanitized README — removed personal data, internal paths, and operational details.
- Restored skill name to "BrainX V5" after security flag workaround.

---

## [0.2.8] - 2026-03-16

### Added
- **Security trust section** in SKILL.md.
- **feature_request** CLI shortcut.
- **error-harvester** script: Extracts errors from session logs for automatic learning.
- **auto-promoter** script: Surfaces recurring patterns for rule promotion.
- **35-feature table** in SKILL.md for ClawHub visibility.

### Fixed
- PII phone regex for 7-digit numbers.
- Backup scripts updated for V5 paths.
- eval-dataset NaN crash.
- Simplified skill name to use hyphen instead of em-dash for ClawHub compatibility.

### Changed
- Excluded cron, tests, scripts from published package to reduce security flags.
- Bumped through 0.2.1 → 0.2.5 → 0.2.8 for ClawHub publishes.

---

## [0.2.0] - 2026-03-16

### Added
- First ClawHub publish.
- SKILL.md translated to English.
- Redacted leaked token from repo.

### Fixed
- **Cross-agent memory injection**: Reserved 30% slots for other agents' memories.
- **Hook query split**: `queryAgentAwareMemories` split into own + cross slots.
- **CLI positional args**: Support for `add`/`fact` positional arguments.

### Changed
- Validation and sync checklist documented.
- Memory-md-harvester script added.

---

## [0.1.0] - 2026-03-15

### Added
- **BrainX V5 core**: Advisory system, EIDOS evaluation loop, memory consolidation, agent-aware injection.
- **MEMORY.md block injection**: Auto-inject hook for OpenClaw gateway bootstrap.
- **Fix for MEMORY.md duplication**: Use `lastIndexOf` for BrainX markers to prevent block duplication.
- Audit fixes, gotchas injection, schema migrations, CLI documentation.

### Changed
- Major rewrite from V4 to V5 architecture.

---

## [0.0.x] - 2026-02-15 to 2026-03-05

### Added
- **V4 core**: Governance, lifecycle, observability (2026-02-23).
- **Auto-inject hook**: Bootstrap hook, backup/restore system, disaster recovery (2026-02-20).
- **OpenClaw skill integration**: SKILL.md + README for skill ecosystem (2026-02-19).
- **CLI**: `add`, `search`, `inject`, `health`, `doctor`, `fact`, `resolve`, `advisory`, `eidos` commands.
- **pgvector**: Semantic search with OpenAI embeddings.
- **Truncation**: Max chars/lines per memory on inject output.
- **Documentation**: Full docs set with quickstart and usage.

### Fixed
- Symlink ROOT resolution + `--help` without env.
- Embedding excluded from search SELECT for compact output.

---

*Updated — 2026-04-05*
