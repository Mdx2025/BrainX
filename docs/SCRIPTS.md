# Scripts

Run scripts from the repository root.

## Capture

- `memory-distiller.js` — extracts durable memories from session text.
- `fact-extractor.js` — extracts structured operational facts.
- `session-harvester.js` — classifies and imports session-derived records.
- `memory-md-harvester.js` — imports workspace memory markdown.

## Curation

- `quality-scorer.js`
- `dedup-supersede.js`
- `contradiction-detector.js`
- `cleanup-low-signal.js`
- `reclassify-memories.js`
- `degrade-over-injected.js`

## Governance

- `auto-promoter.js` — stages rule suggestions.
- `promotion-applier.js` — applies reviewed promotions.
- `cleanup-promotion-suggestions.js`

## Knowledge

- `import-knowledge-md.js`
- `knowledge-sync.js`
- `knowledge-locate.js`
- `new-knowledge-topic.js`
- `seed-knowledge-library.js`
- `sync-knowledge-auto-blocks.js`

## Backup And Restore

- `backup-brainx.sh`
- `restore-brainx.sh`
- `weekly-backup.sh`

## Evaluation

- `eval-memory-quality.js`
- `generate-eval-dataset-from-memories.js`
