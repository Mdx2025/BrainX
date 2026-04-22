# Recall On Demand

BrainX recall should be explicit when the task depends on prior decisions, project history, preferences, repeated failures, or operational gotchas.

## Recommended Order

1. Inspect live artifacts first when the answer depends on current code, logs, database state, tests, or runtime behavior.
2. Use BrainX search for prior context:

```bash
./brainx search --query "what happened last time this failed?" --limit 10
```

3. Use injection only when a compact context pack helps the current task:

```bash
./brainx inject "current task summary"
```

4. If memory conflicts with live evidence, trust live evidence.

## Good Recall Queries

- "deployment gotchas for this project"
- "previous decision about database migrations"
- "known failures with this provider"
- "installation notes for BrainX plugin"

## Avoid

- Treating memory as proof.
- Injecting broad context into every task.
- Sharing private workspace or user-specific memories in public docs.
