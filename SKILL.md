---
name: "BrainX V5 — The First Brain for OpenClaw"
description: |
  Vector memory engine with PostgreSQL + pgvector + OpenAI embeddings.
  Stores, searches, and injects contextual memories into LLM prompts.
  Includes auto-injection hook for OpenClaw and full backup/recovery system.
metadata:
  openclaw:
    emoji: "🧠"
    requires:
      bins: ["psql"]
      env: ["DATABASE_URL", "OPENAI_API_KEY"]
    primaryEnv: "DATABASE_URL"
    hooks:
      - name: brainx-auto-inject
        event: agent:bootstrap
        description: Auto-injects relevant memories at session start
user-invocable: true
---

# BrainX V5 — The First Brain for OpenClaw

Persistent memory system using vector embeddings for contextual retrieval in AI agents.

## 39 Implemented Capabilities

Treat this as a grouped capability map, not as 39 unrelated product bullets. In practice, these cluster into storage/retrieval, trust/governance, bootstrap/live capture, maintenance/ops, knowledge, and evaluation.

| # | Feature | Description |
|---|---------|-------------|
| 1 | ✅ **Production-Ready** | Centralized shared memory across all your agents — scales from 1 to hundreds |
| 2 | 🧠 **Auto-Learning** | Captures and curates memory automatically from conversations, with review gates where durable rule writes would be risky |
| 3 | 💾 **Persistent Memory** | Remembers across sessions — PostgreSQL + pgvector |
| 4 | 🤝 **Shared Memory** | All agents share the same knowledge pool |
| 5 | 💉 **Automatic Briefing** | Personalized context injection at each agent startup |
| 6 | 🔎 **Semantic Search** | Searches by meaning, not exact keywords |
| 7 | 🏷️ **Intelligent Classification** | Auto-typed: facts, decisions, learnings, gotchas, notes |
| 8 | 📊 **Usage-Based Prioritization** | Hot/warm/cold tiers — automatic promote/degrade based on access |
| 9 | 🤝 **Cross-Agent Learning** | Propagates only verified operational gotchas, facts, and decisions across agents |
| 10 | 🔄 **Anti-Duplicates** | Semantic deduplication by cosine similarity with intelligent merge |
| 11 | ⚡ **Anti-Contradictions** | Detects contradictory memories and supersedes the obsolete one |
| 12 | 📋 **Session Indexing** | Searches past conversations (30-day retention) |
| 13 | 🔒 **PII Scrubbing** | Automatic redaction of sensitive data before storage |
| 14 | 🔮 **Pattern Detection** | Detects recurring patterns and promotes them automatically |
| 15 | 🛡️ **Disaster Recovery** | Full backup/restore (DB + configs + hooks + workspaces) |
| 16 | ⭐ **Quality Scoring** | Evaluates memory quality and promotes only what deserves to persist |
| 17 | ⚙️ **Fact Extraction** | Regex + LLM pipelines capture both operational facts and nuanced learnings |
| 18 | 📦 **Context Packs** | Weekly project packs and bootstrap topic files for fast situational awareness |
| 19 | 📈 **Telemetry** | Query logs, injection metrics, and health monitoring built in |
| 20 | 🧵 **Supersede Chains** | Old memories can be replaced cleanly without losing history |
| 21 | 🌀 **Memory Distillation** | Consolidates raw logs into higher-signal memories over time |
| 22 | 🛡️ **Pre-Action Advisory** | Queries past mistakes before high-risk tool execution |
| 23 | 👤 **Agent Profiles** | Per-agent hook injection: boosts/filters memories by agent role |
| 24 | 🔀 **Cross-Agent Recall** | Cross-agent knowledge is retrieved on demand when local-first context is insufficient |
| 25 | 📊 **Metrics Dashboard** | CLI dashboard with top patterns, memory stats, and usage trends |
| 26 | 🔧 **Doctor & Auto-Fix** | Schema integrity check + automatic repair of detected issues |
| 27 | 👍 **Memory Feedback** | Mark memories as useful/useless/incorrect to refine quality |
| 28 | 🗺️ **Trajectory Recording** | Records problem→solution paths for future reference |
| 29 | 📝 **Learning Details** | Extended metadata extraction for learnings and gotchas |
| 30 | 🔄 **Lifecycle Management** | Automatic promotion/degradation of memories by age and usage |
| 31 | 📥 **Workspace Import** | Imports existing MEMORY.md files from all workspaces into the brain |
| 32 | 🧪 **Eval Dataset Generation** | Generates evaluation datasets from real memories for quality testing |
| 33 | 🏗️ **Session Snapshots** | Captures full agent state at session close for analysis |
| 34 | 🧹 **Low-Signal Cleanup** | Automatic cleanup of low-value, outdated, or redundant memories |
| 35 | 🔃 **Memory Reclassification** | Reclassifies memories with correct types and categories post-hoc |
| 36 | 🔄 **Auto-Promotion Pipeline** | Detects high-recurrence patterns and stages vetted rule suggestions for the canonical `agent-core` reference file; final writes are review-gated instead of fully automatic |
| 37 | 📊 **16-Step Daily Pipeline** | Consolidated daily pipeline: bootstrap, lifecycle, distiller, harvester, bridge, auto-distiller, consolidation, cross-agent learning, contradiction detection, markdown harvester, error harvester, auto-promoter, gated promotion-applier, memory-enforcer, memory-audit, and context-pack-builder |
| 38 | ⚡ **Near-Real-Time Live Capture** | Captures high-signal outbound recommendations at `message:sent` into workspace daily memory and BrainX before compaction or cron distillation |
| 39 | 📡 **Live Capture Observability** | `doctor` and `metrics` expose live-capture volume, low-signal skips, duplicates, persistence failures, latency, and last success/error |

## When to Use

✅ **USE when:**
- An agent needs to "remember" information from previous sessions
- You want to give additional context to an LLM about past actions
- You need semantic search by content
- You want to store important decisions with metadata

❌ **DON'T USE when:**
- Ephemeral information that doesn't need persistence
- Structured tabular data (use a regular DB)
- Simple cache (use Redis or in-memory)

## Auto-Injection (Hook)

BrainX V5 includes an **OpenClaw hook** that automatically injects relevant memories when an agent starts.

### Bootstrap Trust Model

Injected BrainX context is **advisory**. It is useful for recall, not for authority.

- Memory helps with hypotheses, prior decisions, recurring gotchas, and faster orientation.
- If memory conflicts with active code, runtime behavior, DB state, logs, tests, screenshots, or a direct user correction, **the live artifact wins**.
- Do not claim `listo`, revert code, or switch a business-flow conclusion based only on MEMORY/BrainX/summaries/ARCHITECTURE/CHANGELOG when you can inspect the real system.
- `learning` memories stay stored and searchable, but they are excluded from bootstrap auto-injection by default because they are the easiest class to overgeneralize.
- Cross-agent knowledge is still available through explicit `brainx search` / `brainx inject` fallback.

### Verification States

Each memory can carry a trust state used by retrieval:

- `verified` — highest trust
- `hypothesis` — tentative
- `changelog` — historical context only
- `obsolete` — excluded

`advisory` and retrieval now prefer `verified` memories and downgrade the rest accordingly.

### Production Validation Status

Real validation refreshed on **2026-04-02**:
- Global hook enabled in `~/.openclaw/openclaw.json`
- Managed hooks synced with `~/.openclaw/skills/brainx-v5/` (`brainx-auto-inject` + `brainx-live-capture`)
- Active physical database: `brainx_v5`
- `agent-profiles.json` currently covers 33 profiles
- Local-first bootstrap activated in production; cross-agent retrieval now happens via explicit fallback search/inject
- `brainx fix` now also demotes carried-stale consolidated rows plus stale low-provenance memories before they can pollute `hot/warm`
- `brainx doctor --full --json` → `ok: true`, `41 passed`, `0 warnings`, `0 failures`
- CLI tests and smoke suite passed locally
- Bootstrap telemetry present in `brainx_pilot_log`; live-capture telemetry present in `brainx-live-capture.log`
- Expected evidence confirmed:
  - `<!-- BRAINX:START -->` block written into `MEMORY.md`
  - `Updated:` timestamp present
  - Fresh row recorded in `brainx_pilot_log`

Recently cleared in this refresh:
- stale hot/warm warning reduced to `0`
- duplicate sample warning reduced to `0` pairs `>0.95`

If this validation becomes stale, rerun `./brainx-v5 doctor --full --json` plus a bootstrap smoke test before assuming runtime is still healthy.

### How it works:

1. `agent:bootstrap` event → Hook fires automatically
2. PostgreSQL query → Fetches local-first hot/warm memories with governed trust weighting
3. Writes runtime docs → Updates `MEMORY.md`, `BRAINX_CONTEXT.md`, and `brainx-topics/` in the workspace
4. Agent reads → Stable guide from the skill, live context from the workspace

### Canonical layout:

- Stable guide: `~/.openclaw/skills/brainx-v5/brainx.md`
- Runtime context: `BRAINX_CONTEXT.md` + `brainx-topics/` in each workspace
- Durable manual knowledge: `~/.openclaw/skills/brainx-v5/knowledge/`
- Source of truth doc: `docs/CANONICAL_LAYOUT.md`

### Configuration:

In `~/.openclaw/openclaw.json`:
```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "brainx-auto-inject": {
          "enabled": true,
          "limit": 5,
          "tier": "hot+warm",
          "minImportance": 5
        }
      }
    }
  }
}
```

### Per-agent setup:

Add to `AGENTS.md` in each workspace:
```markdown
## Every Session

1. Read `SOUL.md`
2. Read `USER.md`
3. Read `~/.openclaw/skills/brainx-v5/brainx.md`
4. Read `BRAINX_CONTEXT.md` ← Auto-injected context
5. Read `brainx-topics/*.md` only when deeper detail is needed
```

## Available Tools

### brainx_add_memory

Saves a memory to the vector brain.

**Parameters:**
- `content` (required) — Memory text
- `type` (optional) — Type: note, decision, action, learning (default: note)
- `context` (optional) — Namespace/scope
- `tier` (optional) — Priority: hot, warm, cold, archive (default: warm)
- `importance` (optional) — Importance 1-10 (default: 5)
- `tags` (optional) — Comma-separated tags
- `agent` (optional) — Name of the agent creating the memory

**Example:**
```
brainx add --type decision --content "Use embeddings 3-small to reduce costs" --tier hot --importance 9 --tags config,openai
```

### brainx_search

Searches memories by semantic similarity.

**Parameters:**
- `query` (required) — Search text
- `limit` (optional) — Number of results (default: 10)
- `minSimilarity` (optional) — Threshold 0-1 (default: 0.3)
- `minImportance` (optional) — Filter by importance 0-10
- `tier` (optional) — Filter by tier
- `context` (optional) — Exact context filter

**Example:**
```
brainx search --query "API configuration" --limit 5 --minSimilarity 0.5
```

**Returns:** JSON with results.

### brainx_inject

Gets memories formatted for direct injection into LLM prompts.

**Parameters:**
- `query` (required) — Search text
- `limit` (optional) — Number of results (default: 10)
- `minImportance` (optional) — Filter by importance
- `tier` (optional) — Tier filter (default: hot+warm)
- `context` (optional) — Context filter
- `maxCharsPerItem` (optional) — Truncate content (default: 2000)

**Example:**
```
brainx inject --query "what decisions were made about openai" --limit 3
```

**Returns:** Formatted text ready for injection:
```
[sim:0.82 imp:9 tier:hot type:decision agent:coder ctx:openclaw]
Use embeddings 3-small to reduce costs...

---

[sim:0.71 imp:8 tier:hot type:decision agent:support ctx:brainx]
Create SKILL.md for OpenClaw integration...
```

### brainx_health

Verifies BrainX is operational.

**Parameters:** none

**Example:**
```
brainx health
```

**Returns:** PostgreSQL + pgvector connection status.

## Backup and Recovery

### Create Backup

```bash
./scripts/backup-brainx.sh ~/backups
```

Creates `brainx-v5_backup_YYYYMMDD_HHMMSS.tar.gz` containing:
- Full PostgreSQL database (SQL dump)
- OpenClaw configuration (hooks, .env)
- Skill files
- Workspace documentation

### Restore Backup

```bash
./scripts/restore-brainx.sh backup.tar.gz --force
```

Fully restores BrainX V5 including:
- All memories (with embeddings)
- Hook configuration
- Environment variables

### Full Documentation

See [RESILIENCE.md](RESILIENCE.md) for:
- Complete disaster scenarios
- Migration to new VPS
- Troubleshooting
- Automatic backup configuration

## Configuration

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/brainx_v5
OPENAI_API_KEY=sk-...

# Optional
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
BRAINX_INJECT_DEFAULT_TIER=hot+warm
BRAINX_INJECT_MAX_CHARS_PER_ITEM=2000
BRAINX_INJECT_MAX_LINES_PER_ITEM=80
```

### Database Setup

```bash
# Schema is in ~/.openclaw/skills/brainx-v5/sql/
# Requires PostgreSQL with pgvector extension

psql $DATABASE_URL -f ~/.openclaw/skills/brainx-v5/sql/v3-schema.sql
```

## Direct Integration

You can also use the unified wrapper that reads the API key from OpenClaw:

```bash
cd ~/.openclaw/skills/brainx-v5
./brainx add --type note --content "test"
./brainx search --query "test"
./brainx inject --query "test"
./brainx health
```

Compatibility: `./brainx-v5` and `./brainx-v5-cli` also work as aliases for the main wrapper.

## Advisory System (Pre-Action Check)

BrainX includes an advisory system that queries relevant memories, trajectories, and recurring patterns before executing high-risk tools. Helps agents avoid repeating past mistakes.

### High-Risk Tools

The following tools automatically trigger advisory checks: `exec`, `deploy`, `railway`, `delete`, `rm`, `drop`, `git push`, `git force-push`, `migration`, `cron`, `message send`, `email send`.

### CLI Usage

```bash
# Check for advisories before a tool execution
./brainx-v5 advisory --tool exec --args '{"command":"rm -rf /tmp/old"}' --agent coder --json

# Quick check via helper script
./scripts/advisory-check.sh exec '{"command":"rm -rf /tmp/old"}' coder
```

### Agent Integration (Manual)

Since only `agent:bootstrap` is supported as a hook event, agents should manually call `brainx advisory` before high-risk tools:

```bash
# In agent SKILL.md or AGENTS.md, add:
# Before exec/deploy/delete/migration, run:
cd ~/.openclaw/skills/brainx-v5 && ./scripts/advisory-check.sh <tool> '<args_json>' <agent>
```

The advisory returns relevant memories, similar past problem→solution paths, and recurring patterns with a confidence score. It's informational — never blocking.

### Agent-Aware Hook Injection

The `agent:bootstrap` hook uses **agent profiles** (`hook/agent-profiles.json`) to customize memory injection per agent:

- **Execution agents** (`coder`, CLI agents, `raider`, `reasoning`): narrow bootstrap to code/ops-adjacent contexts and prioritize gotcha/error/decision
- **Content agents** (`writer`, `researcher`, `clawma`, `karl`, `matrix`, etc.): prioritize fact/decision in content contexts
- **Monitoring/support agents**: prioritize health/monitoring/operations errors and gotchas
- **Default bootstrap policy**: exclude `learning` from auto-injection unless a profile opts in later for a proven reason

Agents not listed in the profiles file get the default unfiltered injection. Edit `hook/agent-profiles.json` to add new agent profiles.

### Cross-Agent Memory Sharing

The hook now follows a **local-first bootstrap** policy for all agents. Cross-agent memories stay available, but they are retrieved through explicit `brainx search` / `brainx inject` fallback when local context is insufficient. The `cross-agent-learning.js` script still tags high-importance memories so that fallback recall can surface them without duplicates.

## Security & Trust

This skill is flagged with "suspicious patterns" by ClawHub's automated scanner. Here's what each pattern does and why it's necessary:

| Pattern | File | Why |
|---|---|---|
| `child_process.execFile` | `hook/handler.js` | Invokes the BrainX CLI to query memories during agent bootstrap. No arbitrary command execution. |
| `process.env` access | `lib/db.js`, `lib/openai-rag.js`, `lib/cli.js` | Reads `DATABASE_URL` and `OPENAI_API_KEY` to connect to PostgreSQL and generate embeddings. Standard for any database-backed skill. |
| `fetch('https://api.openai.com')` | `lib/openai-rag.js` | Calls OpenAI Embeddings API to generate vector representations. Single endpoint, no other network calls. |
| File read/write | `hook/handler.js` | Writes `BRAINX_CONTEXT.md`, `brainx-topics/*.md`, and updates `MEMORY.md` in the agent's workspace during bootstrap injection. |

**No secrets are stored in code.** All credentials come from environment variables. No data leaves the system except embedding requests to OpenAI.

## Notes

- Memories are stored with vector embeddings (1536 dimensions)
- Search uses cosine similarity
- `inject` is the most useful tool for giving context to LLMs
- Tier hot = fast access, cold/archive = long-term storage
- Memories are persistent in PostgreSQL (independent of OpenClaw)
- Auto-injection hook fires on every `agent:bootstrap`

## Feature Status (Tables)

### ✅ All Operational
| Table | Function | Status |
|---|---|---|
| `brainx_memories` | Core: stores memories with embeddings | ✅ Active (2,400+) |
| `brainx_advisories` | Pre-action advisory history | ✅ Active |
| `brainx_distillation_log` | Distillation run audit log | ✅ Active |
| `brainx_eidos_cycles` | Prediction/evaluation/distillation loop | ✅ Active |
| `brainx_query_log` | Tracks search/inject queries | ✅ Active |
| `brainx_pilot_log` | Tracks auto-inject per agent | ✅ Active |
| `brainx_context_packs` | Pre-generated context packages | ✅ Active |
| `brainx_patterns` | Detects recurring errors/issues | ✅ Active |
| `brainx_schema_version` | Schema version tracking | ✅ Active |
| `brainx_session_snapshots` | Captures state at session close | ✅ Active |
| `brainx_learning_details` | Extended metadata for learning/gotcha memories | ✅ Active |
| `brainx_trajectories` | Records problem→solution paths | ✅ Active |

> 12/12 tables operational. Verified again on 2026-03-27 via `brainx doctor --full` (37 passing checks, 0 failures).

## Full Feature Inventory (35)

### CLI Core (`brainx <cmd>`)
| # | Command | Function |
|---|---|---|
| 1 | `add` | Save memory (7 types, 20+ categories, V5 metadata) |
| 2 | `search` | Semantic search by cosine similarity |
| 3 | `inject` | Formatted memories for LLM prompt injection |
| 4 | `fact` / `facts` | Shortcut to save/list infrastructure facts |
| 5 | `resolve` | Mark pattern as resolved/promoted/wont_fix |
| 6 | `promote-candidates` | Detect memories eligible for promotion |
| 7 | `lifecycle-run` | Degrade/promote memories by age/usage |
| 8 | `metrics` | Metrics dashboard and top patterns |
| 9 | `doctor` | Base diagnostics plus `doctor --full` for command surface and functional probes |
| 10 | `fix` | Auto-repair issues detected by doctor |
| 11 | `feedback` | Mark memory as useful/useless/incorrect |
| 12 | `health` | PostgreSQL + pgvector connection status |

### Processing Scripts (`scripts/`)
| # | Script | Function |
|---|---|---|
| 13 | `memory-bridge.js` | Syncs memory between sessions/agents |
| 14 | `memory-distiller.js` | Distills sessions into new memories |
| 15 | `session-harvester.js` | Harvests info from past sessions |
| 16 | `session-snapshot.js` | Captures state at session close |
| 17 | `pattern-detector.js` | Detects recurring errors/issues |
| 18 | `learning-detail-extractor.js` | Extracts metadata from learnings/gotchas |
| 19 | `trajectory-recorder.js` | Records problem→solution paths |
| 20 | `fact-extractor.js` | Extracts facts from conversations |
| 21 | `contradiction-detector.js` | Detects contradicting memories |
| 22 | `cross-agent-learning.js` | Shares verified operational knowledge between agents |
| 23 | `quality-scorer.js` | Scores memory quality |
| 24 | `context-pack-builder.js` | Generates pre-built context packages |
| 25 | `reclassify-memories.js` | Reclassifies memories with correct types/categories |
| 26 | `cleanup-low-signal.js` | Cleans up low-value memories |
| 27 | `dedup-supersede.js` | Detects and marks duplicates |
| 28 | `eval-memory-quality.js` | Evaluates dataset quality |
| 29 | `generate-eval-dataset-from-memories.js` | Generates evaluation dataset |
| 30 | `memory-feedback.js` | Per-memory feedback system |
| 31 | `import-workspace-memory-md.js` | Imports from workspace MEMORY.md files |
| 32 | `import-knowledge-md.js` | Imports curated `knowledge/` docs as canonical knowledge |
| 33 | `knowledge-sync.js` | Detects manual changes in `knowledge/`, imports only when needed, and refreshes the auto block |
| 34 | `new-knowledge-topic.js` | Creates canonical knowledge topic files with manual + auto blocks |
| 35 | `sync-knowledge-auto-blocks.js` | Refreshes the auto-managed BrainX block inside knowledge docs |
| 36 | `seed-knowledge-library.js` | Creates realistic seed topics across the knowledge taxonomy |
| 37 | `migrate-v2-to-v3.js` | Schema migration V2→V3 |
| 38 | `promotion-applier.js` | Last-mile gated promotion: distills vetted patterns and writes rules to the canonical `agent-core` reference file |
| 39 | `calibrate-verification-state.js` | Conservatively promotes durable changelog memories to verified |
| 40 | `cleanup-promotion-suggestions.js` | Purges stale, duplicate, or low-signal promotion suggestions |

### Hooks and Infrastructure
| # | Component | Function |
|---|---|---|
| 41 | `brainx-auto-inject` | Auto-injection hook at each agent bootstrap |
| 42 | `backup-brainx.sh` | Full backup (DB + config + skills) |
| 43 | `restore-brainx.sh` | Full restore from backup |
| 44 | `promotion-applier.js` | Pipeline step 13: writes promoted patterns to the canonical `agent-core` reference file behind a review gate |

### V5 Metadata
- `sourceKind` — Origin: user_explicit, agent_inference, tool_verified, llm_distilled, knowledge_canonical, etc.
- `sourcePath` — Source file/URL
- `confidence` — Score 0-1
- `expiresAt` — Automatic expiration
- `sensitivity` — normal/sensitive/restricted
- Automatic PII scrubbing (`BRAINX_PII_SCRUB_ENABLED`)
- Similarity-based dedup (`BRAINX_DEDUPE_SIM_THRESHOLD`)
