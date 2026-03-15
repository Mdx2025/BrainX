# 🧠 BrainX V5 — The First Brain for OpenClaw

![BrainX Banner](assets/brainx-banner.png)

> **Your AI agents forget everything after each session. BrainX fixes that — permanently.**

BrainX is a persistent vector memory engine for [OpenClaw](https://openclaw.ai) that gives your AI agents real, long-term memory. Built on PostgreSQL + pgvector + OpenAI embeddings, it stores, searches, and auto-injects contextual memories into every agent session.

**One brain. Every agent. Shared intelligence that grows smarter with every conversation.**

[![Install from ClawHub](https://img.shields.io/badge/ClawHub-Install-blue)](https://clawhub.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Why BrainX?

Without BrainX, every OpenClaw session starts from zero. Your agents are **amnesiac by default** — they forget decisions, preferences, learnings, and context the moment a session ends.

BrainX changes the game:

- **Persistent Memory** — Memories survive across sessions in PostgreSQL
- **Auto-Learning** — Learns from every conversation automatically, zero manual work
- **Hive Mind** — All agents share one brain. One agent learns → every agent benefits
- **Semantic Search** — Find memories by meaning, not exact keywords (RAG/vector search)
- **Auto-Injection** — Relevant context injected into every session on startup, personalized per agent
- **Active Intelligence** — Advisory system warns agents before risky actions, EIDOS loop learns from outcomes
- **Battle-Tested** — Running in production with 10+ agents 24/7

---

## What's New in V5

- 🎯 **Advisory System** — Pre-action warnings for high-risk tools based on past failures and patterns
- 🔄 **EIDOS Loop** — Prediction → Outcome → Evaluation → Distillation cycle for adaptive learning
- ⚗️ **Auto-Distiller** — Processes session logs and auto-generates high-quality memories with smart heuristics
- 🧹 **Memory Consolidation** — Clusters semantically similar memories and merges them via LLM (~22% noise reduction)
- 🚪 **Pre-Storage Quality Gate** — Rejects noise ("ok", "HEARTBEAT_OK", short content) before it enters the DB
- 📊 **Enhanced Scoring** — Retrieval integrates feedback_score, confidence_score, and temporal decay
- 🧬 **Agent-Aware Injection** — Per-agent profiles with context boosts and type prioritization
- 🏗️ **HNSW Indexing** — Faster vector search at scale (replaces IVFFlat)

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | 🧠 **Persistent Memory** | Memories stored in PostgreSQL + pgvector — survive across all sessions |
| 2 | 📥 **Auto-Learning** | Learns from every conversation automatically — no manual intervention |
| 3 | 🤝 **Hive Mind** | All agents share the same memory pool — collective intelligence |
| 4 | 🔎 **Semantic Search** | Vector similarity search powered by OpenAI embeddings |
| 5 | 💉 **Auto-Injection** | OpenClaw hook injects relevant context on every agent bootstrap |
| 6 | 🧬 **Agent-Aware Profiles** | Per-agent injection with context boosts, type prioritization, and affinity scoring |
| 7 | 🏷️ **Smart Classification** | Auto-types: facts, decisions, learnings, gotchas, notes, feature requests |
| 8 | 📊 **Priority Tiers** | Hot/warm/cold tiers with automatic promotion and degradation |
| 9 | 🤝 **Cross-Agent Learning** | Propagates important discoveries across all agents automatically |
| 10 | 🔄 **Semantic Deduplication** | Cosine similarity dedup with intelligent merge |
| 11 | 🧹 **Memory Consolidation** | Clusters near-duplicates and merges them into single high-quality memories |
| 12 | ⚡ **Contradiction Detection** | Finds conflicting memories and supersedes the obsolete one |
| 13 | 🔒 **PII Scrubbing** | Auto-redacts API keys, emails, phone numbers, passwords before storage |
| 14 | 🔮 **Pattern Detection** | Detects recurring patterns and auto-promotes them to higher tiers |
| 15 | 📋 **Session Indexing** | Searches past conversations with 30-day retention |
| 16 | ⭐ **Quality Scoring** | Multi-dimensional quality evaluation with auto-promote/degrade |
| 17 | 🚪 **Pre-Storage Quality Gate** | Rejects noise and downgrades short content before storage |
| 18 | 📌 **Fact Extraction** | Regex extracts URLs, repos, ports, branches, configs from sessions |
| 19 | ⚗️ **Auto-Distiller** | Processes session logs to auto-generate memories from error-fix sequences, decisions, and complex sessions |
| 20 | 🎯 **Advisory System** | Pre-action advice for high-risk tools based on historical memory and patterns |
| 21 | 🔄 **EIDOS Loop** | Prediction → Outcome → Evaluation → Distillation — adaptive learning cycle |
| 22 | 📦 **Context Packs** | Weekly context packages organized per project and per agent |
| 23 | 🔍 **Telemetry** | Injection logs, query performance metrics, operational dashboards |
| 24 | 🔗 **Supersede Chains** | Obsolete memories marked but never deleted — full audit trail |
| 25 | 🧬 **Memory Distiller** | LLM (gpt-4o-mini) extracts structured memories from session logs |
| 26 | 🛡️ **Disaster Recovery** | Full backup/restore: database, configs, hooks, workspaces |
| 27 | 💾 **Production Ready** | Battle-tested with 10+ agents running continuously |

---

## Auto-Learning: How BrainX Teaches Itself

> BrainX doesn't just store memories — it **learns on its own.** Every conversation becomes permanent, shared knowledge without any human intervention.

Auto-Learning is the orchestration of capture, curation, propagation, and injection that converts ephemeral conversations into permanent collective intelligence. It runs 24/7 via a single consolidated cron pipeline.

### The Auto-Learning Cycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    🧠 AUTO-LEARNING CYCLE (V5)                           │
│                                                                          │
│   ┌─────────────┐    ┌──────────────┐    ┌──────────────┐               │
│   │   Agent      │    │   Markdown   │    │   Manual     │               │
│   │   Sessions   │    │   memory/*.md│    │   (agents)   │               │
│   └──────┬──────┘    └──────┬───────┘    └──────┬───────┘               │
│          │                  │                    │                        │
│          ▼                  ▼                    ▼                        │
│   ┌─────────────────────────────────────────────────────┐               │
│   │          📥 AUTOMATIC CAPTURE (5 layers)             │               │
│   │                                                      │               │
│   │  Memory Distiller ──► LLM extracts memories          │               │
│   │  Auto-Distiller   ──► Heuristic session mining       │               │
│   │  Fact Extractor   ──► Regex extracts hard data       │               │
│   │  Session Harvester ─► Heuristics classify            │               │
│   │  Memory Bridge    ──► Sync markdown → vectors        │               │
│   └──────────────────────────┬──────────────────────────┘               │
│                              ▼                                           │
│                    ┌─────────────────┐                                   │
│                    │  PostgreSQL +   │                                   │
│                    │  pgvector       │                                   │
│                    │  (centralized   │                                   │
│                    │   memory)       │                                   │
│                    └────────┬────────┘                                   │
│                             │                                            │
│     ┌───────────────────────┼────────────────────────┐                  │
│     ▼                       ▼                        ▼                  │
│ ┌──────────────┐  ┌─────────────────┐  ┌───────────────────┐           │
│ │ 🔄 SELF-     │  │ 🤝 CROSS-      │  │ 🔮 PATTERN &     │           │
│ │ IMPROVEMENT  │  │ AGENT           │  │ ADVISORY         │           │
│ │              │  │ LEARNING        │  │                   │           │
│ │ Quality Gate │  │                 │  │ Pattern detect    │           │
│ │ Quality Score│  │ Propagate       │  │ EIDOS loop        │           │
│ │ Consolidation│  │ gotchas &       │  │ Advisory system   │           │
│ │ Dedup        │  │ learnings       │  │ Trajectory track  │           │
│ │ Contradict.  │  │ to ALL agents   │  │                   │           │
│ │ Cleanup      │  │                 │  │                   │           │
│ │ Lifecycle    │  │                 │  │                   │           │
│ └──────┬───────┘  └──────┬──────────┘  └────────┬──────────┘           │
│        └─────────────────┼───────────────────────┘                      │
│                          ▼                                               │
│                 ┌─────────────────┐                                      │
│                 │ 💉 AGENT-AWARE  │                                      │
│                 │ INJECTION       │                                      │
│                 │                 │                                      │
│                 │ Per-agent       │                                      │
│                 │ profiles &      │                                      │
│                 │ context boosts  │                                      │
│                 │ Score-based     │                                      │
│                 │ ranking         │                                      │
│                 └─────────────────┘                                      │
│                          │                                               │
│                          ▼                                               │
│                 ┌─────────────────┐                                      │
│                 │ 🤖 SMARTER     │                                      │
│                 │ AGENTS          │                                      │
│                 │ every session   │                                      │
│                 └─────────────────┘                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Result:** Every session from every agent feeds the memory → the memory self-optimizes → knowledge propagates → all agents get smarter next session. **Infinite improvement loop.**

---

### Automatic Memory Capture (5 Layers)

BrainX captures memories through 5 complementary mechanisms running in a single daily pipeline:

| Mechanism | How it works | What it captures |
|-----------|-------------|------------------|
| **Memory Distiller** | LLM (gpt-4o-mini) reads full session transcripts | Preferences, decisions, personal data, technical configs, financial info — ALL memory types |
| **Auto-Distiller** | Smart heuristics detect error→fix sequences, explicit decisions, repeated failures, and complex sessions | High-signal memories from raw session logs with ~70% fewer false positives than naive detection |
| **Fact Extractor** | Regex patterns extract structured data | Production URLs, Railway services, GitHub repos, ports, branches, environment configs |
| **Session Harvester** | Heuristics and regex classify conversations | Conversation patterns, recurring topics, operational context |
| **Memory Bridge** | Syncs markdown files with vector database | Manual notes in `memory/*.md`, documentation, written decisions |

### Cross-Agent Learning (The Hive Mind)

When one agent discovers something important (a bug, a gotcha, a learning), it gets automatically propagated to ALL other agents.

**How it works:**
1. Scans recent memories with importance ≥ 7 and types `gotcha`, `learning`, `correction`
2. Identifies memories created by a specific agent
3. Replicates those memories to the context of all other agents
4. Nobody makes the same mistake twice

### Self-Improvement & Quality Curation

The memory optimizes itself — good memories rise, bad ones sink, duplicates merge, contradictions resolve:

| Script | What it does |
|--------|-------------|
| **Pre-Storage Quality Gate** | Rejects noise patterns ("ok", "HEARTBEAT_OK", content < 20 chars) before they enter the DB |
| **quality-scorer.js** | Evaluates memories on specificity, actionability, relevance. Promotes high-quality, degrades low-quality |
| **memory-consolidator.js** | Clusters semantically similar memories (>0.85 cosine) and merges them via LLM, superseding originals |
| **contradiction-detector.js** | Finds contradicting memories. Supersedes the obsolete version |
| **dedup-supersede.js** | Detects near-duplicates by cosine similarity. Intelligent merge keeping the most complete info |
| **cleanup-low-signal.js** | Archives low-value memories: too short, low importance, no recent access |
| **lifecycle-run** | Promotes/degrades between tiers: hot → warm → cold based on age, access, quality |

### Advisory System (V5)

BrainX V5 introduces **proactive intelligence** — the Advisory system warns agents before they execute high-risk actions.

**High-risk tools include:** deploy, database migrations, file deletions, auth changes, service restarts, config rewrites, and more.

**How it works:**
1. Before executing a high-risk tool, the agent queries BrainX for relevant advisories
2. BrainX searches memories for past failures, gotchas, and patterns related to that action
3. Returns contextual warnings with cooldown tracking (no duplicate warnings within 1 hour)
4. Agents can provide feedback on advisory usefulness to improve future recommendations

### EIDOS Loop (V5)

The **EIDOS (Evaluate, Identify, Distill, Optimize, Store)** loop adds adaptive learning through prediction and evaluation:

1. **Predict** — Before an action, record what you expect to happen
2. **Execute** — Perform the action
3. **Evaluate** — Compare outcome vs prediction (correct/partial/wrong)
4. **Distill** — Extract learnings from mismatches
5. **Store** — Save distilled insights as high-quality memories

This creates a feedback loop where agents literally learn from their mistakes.

---

## Architecture

BrainX is intentionally lightweight — no HTTP server needed. It runs as a CLI tool, a single consolidated cron pipeline, and an OpenClaw hook.

### Components

```
┌─────────────────────────────────────────────────────┐
│                   Your Agents                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │Agent1│ │Agent2│ │Agent3│ │Agent4│ │Agent5│     │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘     │
│     └────────┴────────┴────────┴────────┘           │
│                       │                              │
│              ┌────────▼────────┐                     │
│              │  BrainX Hook    │  (agent:bootstrap)  │
│              │  Agent-Aware    │                     │
│              │  Auto-Inject    │                     │
│              └────────┬────────┘                     │
│                       │                              │
│         ┌─────────────┼─────────────┐               │
│         ▼             ▼             ▼               │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Agent     │ │ BrainX   │ │ Advisory │          │
│  │  Profiles  │ │ CLI      │ │ System   │          │
│  └────────────┘ └────┬─────┘ └──────────┘          │
│                       │                              │
│              ┌────────▼────────┐                     │
│              │  OpenAI API     │  embeddings         │
│              └────────┬────────┘                     │
│                       │                              │
│              ┌────────▼────────┐                     │
│              │  PostgreSQL     │  12 tables           │
│              │  + pgvector     │  HNSW indexing      │
│              └─────────────────┘                     │
└─────────────────────────────────────────────────────┘
```

- **PostgreSQL + pgvector** — Stores memories with 1536-dimension vector embeddings and HNSW indexing for fast semantic search
- **OpenAI Embeddings API** — Generates vectors from text using `text-embedding-3-small`
- **Node.js CLI** — Lightweight command-line interface for all memory operations
- **OpenClaw Hook** — Automatically injects relevant context on every agent bootstrap with per-agent profiles
- **Consolidated Pipeline** — Single daily cron job runs all 8 maintenance steps sequentially

### Database Schema (12 Tables)

| Table | Purpose |
|-------|---------|
| `brainx_memories` | Core memory storage with vectors, tiers, types, and metadata |
| `brainx_sessions` | Session index for conversation search |
| `brainx_pilot_log` | Injection telemetry and stats |
| `brainx_trajectories` | Trajectory recording for pattern analysis |
| `brainx_advisories` | Advisory system cooldown and feedback tracking |
| `brainx_eidos_cycles` | EIDOS prediction-evaluation-distillation records |
| `brainx_distillation_log` | Auto-distiller processed sessions log |
| `schema_version` | Schema version tracking |
| + 4 supporting tables | Indexes, constraints, and operational metadata |

### Ranking Algorithm (V5)

Memories are ranked by a composite score that combines multiple signals:

- **Base:** Cosine similarity between query and memory embeddings
- **Importance boost:** `(importance / 10) × 0.25`
- **Tier adjustment:** hot +0.15, warm +0.05, cold -0.05, archive -0.10
- **Feedback boost:** `(feedback_score / 5) × 0.10` — memories validated by agents rank higher
- **Confidence boost:** `(confidence_score) × 0.08` — high-confidence memories get priority
- **Temporal decay:** Recent memories get a slight boost, old untouched memories decay gradually
- **Agent affinity:** +3 for memories from the same agent, +1 for shared/unattributed
- **Context relevance:** +2 for memories matching the agent's profile contexts
- **Type boost:** +1 for memory types matching the agent's priority types

---

## Quick Start

```bash
# 1. Install
clawhub install brainx

# 2. Setup database (after PostgreSQL + pgvector are ready)
cd ~/.openclaw/skills/brainx-v5
cp .env.example .env
# Edit .env with your DATABASE_URL and OPENAI_API_KEY
npm install
psql $DATABASE_URL -f sql/v3-schema.sql

# 3. Verify
./brainx-v5 health

# 4. Add your first memory
./brainx-v5 add --type note --content "BrainX is now live!" --tier hot --importance 10

# 5. Search it
./brainx-v5 search --query "brainx status"

# 6. Deploy the hook (auto-injection)
mkdir -p ~/.openclaw/hooks/brainx-auto-inject
cp hook/{HOOK.md,handler.js,agent-profiles.json,package.json} ~/.openclaw/hooks/brainx-auto-inject/
openclaw hooks enable brainx-auto-inject

# 7. Run the pipeline manually (or set up cron)
./brainx-v5 lifecycle-run
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `./brainx-v5 add` | Store a new memory with type, content, tier, importance, tags |
| `./brainx-v5 search` | Semantic search — find memories by meaning |
| `./brainx-v5 inject` | Search + format for direct LLM prompt injection |
| `./brainx-v5 health` | Verify database connection, tables, pgvector, and system health |
| `./brainx-v5 doctor` | Run 18 diagnostic checks with warnings and fix suggestions |
| `./brainx-v5 fix` | Auto-fix common issues detected by doctor |
| `./brainx-v5 lifecycle-run` | Run tier promotion/degradation cycle |
| `./brainx-v5 advisory` | Get pre-action advice for a specific tool or context |
| `./brainx-v5 eidos predict` | Record a prediction before an action |
| `./brainx-v5 eidos evaluate` | Evaluate an outcome against a prediction |
| `./brainx-v5 eidos stats` | View EIDOS accuracy statistics |

See [docs/CLI.md](docs/CLI.md) for full command reference with all flags and options.

---

## Agent Profiles

BrainX V5 injects memories personalized per agent via `hook/agent-profiles.json`:

```json
{
  "coder": {
    "contexts": ["code", "debug", "infrastructure", "deploy"],
    "boostTypes": ["fact", "gotcha", "error"]
  },
  "writer": {
    "contexts": ["content", "marketing", "seo", "email"],
    "boostTypes": ["note", "decision", "preference"]
  }
}
```

Each agent gets:
- **Agent affinity** — Memories from the same agent rank +3 higher
- **Context relevance** — Memories matching profile contexts rank +2 higher
- **Type boosts** — Priority memory types for this agent rank +1 higher
- **No exclusions** — All agents can access all knowledge; profiles only affect ranking priority

---

## Configuration

See [docs/CONFIG.md](docs/CONFIG.md) for all environment variables and hook configuration options.

---

## Backup & Disaster Recovery

See [RESILIENCE.md](RESILIENCE.md) for:
- Automated backup scheduling
- Full restore procedures
- VPS migration guide
- Disaster recovery scenarios

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Database:** PostgreSQL 14+ with pgvector extension
- **Index:** HNSW (Hierarchical Navigable Small World) for fast approximate nearest neighbor search
- **Embeddings:** OpenAI `text-embedding-3-small` (1536 dimensions)
- **LLM (Distiller):** gpt-4o-mini for memory extraction and consolidation
- **Storage:** ~1KB per memory (text + vector + metadata)
- **Dependencies:** `pg`, `dotenv` (minimal footprint)

---

## Contributing

BrainX is the first community-built brain for OpenClaw. Contributions welcome!

1. Fork the repo
2. Create a feature branch
3. Submit a PR

---

## License

MIT — Use it, modify it, share it. Give your agents a brain. 🧠

---

**Built for the [OpenClaw](https://openclaw.ai) ecosystem. Available on [ClawHub](https://clawhub.ai).**
