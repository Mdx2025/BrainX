# BrainX V6 OpenClaw Plugin

Runtime bridge between OpenClaw and the BrainX V6 persistent memory engine.

## Role

- Inject a small precompiled BrainX wiki digest when enabled.
- Add prompt-aware JIT recall when configured.
- Maintain optional short working memory for active sessions.
- Look up advisories before high-risk tool calls.
- Capture meaningful tool failures conservatively.
- Bridge legacy bootstrap/outbound capture only when explicitly enabled.

## Non-Goals

- Replace the BrainX CLI.
- Replace OpenClaw's built-in memory tools.
- Turn memory into authority over live code, logs, tests, or user corrections.
- Enable write-heavy runtime capture by default.

## Recommended Config

```json
{
  "plugins": {
    "entries": {
      "brainx": {
        "enabled": true,
        "config": {
          "wikiDigest": true,
          "wikiDigestMaxChars": 900,
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

## Rollout Pattern

1. Enable `wikiDigest` first.
2. Verify `brainx doctor --full`.
3. Pilot `jitRecall` with strict similarity and importance thresholds.
4. Enable `workingMemory` only after retention policy is clear.
5. Enable `toolAdvisories` for high-risk tool categories.
6. Enable `captureToolFailures` only after privacy review.

## Safety Defaults

- Cross-agent recall is off unless explicitly allowed.
- Cross-agent recall can require `cross-agent` tag and `verified` state.
- Prompt overlap gates avoid injecting duplicate context.
- Stale, low-importance, or low-similarity memories are filtered.
- Tool failure capture is conservative and can write to daily memory, BrainX, both, or neither depending on config.
