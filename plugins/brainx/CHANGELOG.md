# CHANGELOG

## 2026-04-20

### Bug Fixes
- Corrected JIT recall query extraction for live Discord prompts so system wrappers (`File delivery rule`, BrainX recall snippets, untrusted metadata, and media attachment paths) are not used as semantic search text.
- Restored normal domain matching for repo/branch/path lookup prompts when the actual user body has a relevant match, and added regression coverage that unrelated Discord timeout gotchas are not selected from wrapper noise.
