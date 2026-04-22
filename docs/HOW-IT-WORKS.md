# How BrainX V6 Works

BrainX turns conversation and workspace context into durable, searchable memory.

## Flow

1. Capture high-signal records from explicit CLI calls, markdown imports, session harvesters, or optional runtime surfaces.
2. Scrub sensitive values before storage.
3. Embed memory text with OpenAI embeddings.
4. Store content, metadata, verification state, sensitivity, and vector embedding in PostgreSQL + pgvector.
5. Search by semantic similarity and filters.
6. Curate over time with quality scoring, deduplication, contradiction checks, lifecycle promotion, cleanup, and feedback.
7. Optionally inject compact context through the BrainX OpenClaw plugin.

## Runtime Surfaces

- CLI recall: explicit `brainx search` and `brainx inject`.
- Wiki digest: small precompiled knowledge context.
- Working memory: short session state.
- JIT recall: prompt-aware memory lookup.
- Tool advisories: risk lookup before dangerous actions.
- Failure capture: conservative memory creation for meaningful failures.

All runtime surfaces should be enabled gradually and verified with `brainx doctor --full`.

## Trust

BrainX memory is advisory. Live code, logs, tests, database state, screenshots, and direct user correction override memory.
