# Changelog — BrainX V6

All notable public distribution changes are documented here.

## [0.6.0] - 2026-04-22

### Added

- Renamed public release to **BrainX V6 — The First Brain for OpenClaw**.
- Added the BrainX OpenClaw plugin under `plugins/brainx`.
- Added plugin config schema for wiki digest, JIT recall, working memory, advisories, failure capture, bootstrap bridge, and outbound capture.
- Added knowledge library commands: import, sync, locate, seed, new topic, and auto-block sync.
- Added runtime report and surface policy support.
- Added runtime injection migration and category-domain migrations.
- Added working memory, wiki digest, and runtime observability libraries.
- Added generic public docs for installation, usage, security, plugin rollout, and resilience.

### Changed

- Public README now documents BrainX as a generic OpenClaw memory system for external installations.
- Package metadata now uses version `0.6.0`.
- Public examples now use generic agent roles and project namespaces.
- Local host runtime docs, private memory datasets, tool-failure payloads, backups, logs, and private knowledge content are excluded from the public distribution.
- Hook and doctor paths now resolve from `$HOME`, `$OPENCLAW_HOME`, or the repository root instead of a fixed host path.
- Plugin tests now resolve source files relative to the plugin directory.

### Security

- Removed private agent names, host-specific runtime inventory, private project references, and real-memory evaluation fixtures from the public repo.
- Kept `.env`, database dumps, backups, runtime data, and failure payloads out of the public export.
- Documentation now explicitly states that secrets must remain in local environment variables.

## [0.4.0] - 2026-04-05

### Added

- Verification states: `verified`, `hypothesis`, `changelog`, and `obsolete`.
- Role-aware memory profiles.
- Live-capture observability.
- Review-gated promotion pipeline.
- Hybrid daily/weekly memory maintenance pipeline.
- Memory feedback, learning details, session snapshots, low-signal cleanup, and reclassification.

### Fixed

- Stale memory injection filters.
- Cross-agent learning filters.
- Auto-promotion source filtering.
- Dotenv loading consistency.

## [0.3.x] - 2026-03

### Added

- PostgreSQL + pgvector memory store.
- OpenAI embedding client.
- CLI search, add, inject, metrics, doctor, and fix.
- Memory distillation, fact extraction, session harvesting, quality scoring, deduplication, contradiction detection, and backup/restore scripts.
