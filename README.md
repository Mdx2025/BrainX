# 🧠 BrainX V6 — The First Brain for OpenClaw

![BrainX Banner](assets/brainx-banner.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw Compatible](https://img.shields.io/badge/OpenClaw-Compatible-blue.svg)](https://openclaw.ai)
[![Version](https://img.shields.io/badge/version-0.6.0-green.svg)](https://github.com/Mdx2025/BrainX-The-First-Brain-for-OpenClaw)

**BrainX V6 is persistent AI agent memory for OpenClaw.** It gives OpenClaw agents long-term memory, semantic search, cross-agent learning, automatic curation, runtime recall, and plugin-powered context surfaces using PostgreSQL, pgvector, and OpenAI embeddings.

Without persistent memory, every session starts from zero. BrainX turns conversations, decisions, mistakes, documentation, and operational learnings into a searchable vector brain that improves over time.

## Why BrainX

- **AI agent memory for OpenClaw** — install one shared memory layer for many agents and workspaces.
- **Semantic vector search** — retrieve by meaning, not exact keywords.
- **Persistent memory** — PostgreSQL + pgvector keeps memories across sessions.
- **Cross-agent learning** — verified gotchas, facts, and decisions can be reused by other agents.
- **Auto-learning pipeline** — capture, classify, dedupe, score, consolidate, and promote memories.
- **Runtime plugin** — optional OpenClaw bridge for wiki digest, working memory, JIT recall, tool advisories, and failure capture.
- **Safety-first governance** — PII scrubbing, verification states, sensitivity controls, review-gated rule promotion, and conservative defaults.

## What Is Included

BrainX V6 ships two complementary pieces:

- **BrainX skill and CLI**: memory storage, search, injection, doctor, lifecycle, knowledge sync, backups, migrations, evaluations, and maintenance scripts.
- **BrainX OpenClaw plugin**: optional runtime bridge for precompiled wiki digest, working memory, JIT recall, tool advisories, conservative failure capture, and bridge fallback surfaces.

The CLI is the durable memory engine. The plugin is the runtime adapter.

## Feature Map

| # | Feature | Description |
|---|---|---|
| 1 | Production-ready memory | Shared PostgreSQL + pgvector memory for OpenClaw installations |
| 2 | Auto-learning | Converts conversations and notes into durable memories |
| 3 | Persistent vector storage | Memories survive restarts and new sessions |
| 4 | Shared memory pool | Multiple agents can retrieve from one governed brain |
| 5 | Runtime briefing | Optional context injection and recall surfaces |
| 6 | Semantic search | Meaning-based retrieval with similarity scoring |
| 7 | Intelligent classification | Facts, decisions, learnings, gotchas, corrections, and notes |
| 8 | Usage-based prioritization | Hot, warm, cold, and archive tiers |
| 9 | Cross-agent learning | Reuses verified high-signal knowledge across agents |
| 10 | Semantic deduplication | Detects and merges duplicate memories |
| 11 | Contradiction handling | Supersedes obsolete or conflicting memories |
| 12 | Session indexing | Searchable session-derived memory records |
| 13 | PII scrubbing | Redacts sensitive values before persistence |
| 14 | Pattern detection | Finds recurring mistakes, decisions, and workflows |
| 15 | Backup and restore | Database and file backup scripts |
| 16 | Quality scoring | Promotes useful memory and demotes noise |
| 17 | Fact extraction | Regex and LLM-assisted extraction pipelines |
| 18 | Context packs | Compact memory summaries for efficient retrieval |
| 19 | Telemetry | Query logs, injection metrics, and health reports |
| 20 | Supersede chains | Keeps history while marking outdated memories |
| 21 | Memory distillation | Turns raw records into higher-signal knowledge |
| 22 | Pre-action advisory | Searches known risks before high-risk tools |
| 23 | Agent profiles | Role-aware retrieval and context shaping |
| 24 | Cross-agent recall controls | Tag and verification gates for shared recall |
| 25 | Metrics dashboard | CLI reports for memory quality and usage |
| 26 | Doctor and auto-fix | Schema, data, runtime, and config diagnostics |
| 27 | Memory feedback | Mark memories useful, useless, or incorrect |
| 28 | Trajectory recording | Problem-to-solution path capture |
| 29 | Learning details | Structured metadata for learnings and gotchas |
| 30 | Lifecycle management | Promotion, degradation, expiration, and cleanup |
| 31 | Workspace import | Import existing `MEMORY.md` files |
| 32 | Eval dataset generation | Build memory retrieval evaluation datasets |
| 33 | Session snapshots | Optional state capture for analysis |
| 34 | Low-signal cleanup | Archives outdated, weak, or redundant memories |
| 35 | Reclassification | Corrects memory types and categories post-hoc |
| 36 | Review-gated promotion | Stages durable rule suggestions without unsafe automatic writes |
| 37 | Hybrid maintenance pipeline | Daily lightweight jobs plus deeper weekly maintenance |
| 38 | Near-real-time capture surface | Optional high-signal live capture |
| 39 | Live capture observability | Metrics for capture volume, duplicates, failures, and latency |
| 40 | Knowledge library | Markdown knowledge vault import, sync, and location commands |
| 41 | Wiki digest | Precompiled digest for low-noise runtime context |
| 42 | Working memory | Short session-state layer managed by the plugin |
| 43 | JIT recall | Prompt-aware recall with relevance and duplication gates |
| 44 | Tool advisories | Optional warning surface before risky actions |
| 45 | Failure capture | Conservative capture of meaningful tool failures |
| 46 | Runtime report | CLI visibility into plugin/runtime surfaces |
| 47 | Surface policy | Machine-readable active/manual/dormant/disabled map |
| 48 | OpenClaw plugin config schema | UI-friendly plugin settings and validation |
| 49 | Test coverage | CLI, smoke, RAG, unit, and plugin bridge tests |

## Architecture

```text
OpenClaw agents
    |
    | explicit CLI calls, optional plugin hooks
    v
BrainX V6
    |
    | embeddings + metadata + governance
    v
PostgreSQL + pgvector
```

Core layers:

- `brainx` — CLI entrypoint.
- `lib/` — database, embeddings, RAG, doctor, advisory, wiki, working memory, lifecycle logic.
- `scripts/` — maintenance, imports, cleanup, extraction, promotion, consolidation, knowledge sync.
- `sql/` — schema and migrations.
- `hook/` and `hook-live/` — legacy-compatible hook surfaces.
- `plugins/brainx/` — OpenClaw runtime plugin.
- `docs/` — architecture, CLI, config, schema, tests, and script references.

## Installation

### 1. Requirements

- OpenClaw
- Node.js 20+
- PostgreSQL 14+
- pgvector
- OpenAI API key

### 2. Clone

```bash
git clone https://github.com/Mdx2025/BrainX-The-First-Brain-for-OpenClaw.git
cd BrainX-The-First-Brain-for-OpenClaw
npm install
chmod +x brainx
```

### 3. Create Database

```sql
CREATE DATABASE brainx;
\c brainx
CREATE EXTENSION IF NOT EXISTS vector;
```

Apply schema:

```bash
psql "$DATABASE_URL" -f sql/v3-schema.sql
for file in sql/migrations/*.sql; do psql "$DATABASE_URL" -f "$file"; done
```

### 4. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Set:

```bash
DATABASE_URL=postgresql://brainx:change-me@127.0.0.1:5432/brainx
OPENAI_API_KEY=your-openai-api-key
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
```

No API keys are committed to this repository. Keep `.env` local.

### 5. Verify

```bash
./brainx doctor --full
./brainx health
npm test
```

## Basic Usage

Add a memory:

```bash
./brainx add "Use pgvector cosine similarity for semantic recall" \
  --type decision \
  --importance 8 \
  --context project:example
```

Search:

```bash
./brainx search --query "semantic recall configuration" --limit 5
```

Inject context:

```bash
./brainx inject "What should this agent remember before editing the database?"
```

Locate knowledge:

```bash
./brainx knowledge-locate --query "deployment checklist"
```

Run diagnostics:

```bash
./brainx doctor --full --json
```

## OpenClaw Plugin

The plugin lives in [`plugins/brainx`](plugins/brainx).

Example OpenClaw config:

```json
{
  "plugins": {
    "entries": {
      "brainx": {
        "enabled": true,
        "config": {
          "wikiDigest": true,
          "jitRecall": false,
          "workingMemory": false,
          "toolAdvisories": false,
          "captureToolFailures": false,
          "bootstrapMode": "off",
          "captureOutboundMode": "off"
        }
      }
    }
  }
}
```

Recommended rollout:

1. Start with `wikiDigest=true`.
2. Keep write-path features off until `doctor` is clean.
3. Enable JIT recall or working memory for a small pilot group.
4. Enable advisories and failure capture only after reviewing retention and privacy policy.

## Security And Privacy

BrainX is designed for local-first OpenClaw installations.

- Secrets stay in environment variables.
- `.env`, backups, dumps, logs, runtime memory, and tool-failure data are excluded from this public repo.
- PII scrubbing runs before memory storage.
- Verification states prevent low-trust memories from being treated as authority.
- Cross-agent recall can require `cross-agent` tags and `verified` state.
- Rule promotion is staged and review-gated.
- Memory is advisory: live code, logs, tests, database state, and direct user corrections win.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [CLI](docs/CLI.md)
- [Configuration](docs/CONFIG.md)
- [How It Works](docs/HOW-IT-WORKS.md)
- [Schema](docs/SCHEMA.md)
- [Scripts](docs/SCRIPTS.md)
- [Tests](docs/TESTS.md)
- [Plugin README](plugins/brainx/README.md)

## Repository Hygiene

This repository is a generic public distribution. It intentionally does not include:

- private workspace memory
- local agent names or private runtime inventory
- API keys, tokens, database dumps, or backup files
- host-specific cron config
- tool-failure payloads
- private knowledge vault content

## License

MIT
