# BrainX V6 Resilience

BrainX stores operational memory in PostgreSQL and file-based configuration. A resilient installation protects both.

## Backup Targets

- PostgreSQL database
- `.env` stored outside git
- BrainX repository checkout
- OpenClaw plugin configuration
- Optional knowledge vault

Do not publish backups, dumps, `.env`, runtime memory files, logs, or tool-failure payloads.

## Database Backup

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" > "backups/brainx_$(date +%Y%m%d_%H%M%S).sql"
```

## Database Restore

```bash
psql "$DATABASE_URL" < backups/brainx_YYYYMMDD_HHMMSS.sql
./brainx doctor --full
```

## Health Checks

```bash
./brainx health
./brainx doctor --full --json
./brainx metrics
```

## Recovery Order

1. Restore PostgreSQL.
2. Restore local `.env`.
3. Reinstall dependencies with `npm install`.
4. Reapply migrations if needed.
5. Run `./brainx doctor --full`.
6. Re-enable plugin surfaces gradually.

## Safety Notes

- Keep write-path capture disabled until the database and privacy policy are verified.
- Keep memory advisory; live artifacts still win.
- Rotate API keys if any backup location was exposed.
