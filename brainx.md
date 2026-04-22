# BrainX V6 Quick Guide

BrainX V6 is persistent vector memory for OpenClaw agents.

## Commands

```bash
brainx add "memory text" --type note --context project:example --importance 6
brainx search --query "deployment rules" --limit 10
brainx inject "current task context"
brainx doctor --full
brainx fix
brainx metrics
brainx runtime-report
brainx knowledge-locate --query "proposal playbook"
brainx wiki digest --agent engineering
```

## Memory Types

- `fact`
- `decision`
- `learning`
- `gotcha`
- `correction`
- `note`
- `action`
- `feature_request`

## Verification States

- `verified` — trusted and preferred
- `hypothesis` — useful but tentative
- `changelog` — historical context
- `obsolete` — excluded from active recall

## Context Examples

Use generic namespaces:

- `project:example`
- `agent:engineering`
- `agent:writing`
- `workspace:default`
- `domain:deployment`

## Safety Rules

- Treat retrieved memories as advisory.
- Prefer live code, logs, tests, runtime state, and direct user correction over memory.
- Do not store secrets.
- Keep cross-agent recall gated by verification and tags.
- Review staged rule promotions before writing durable policy.
