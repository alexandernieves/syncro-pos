# Manual migrations

This project does not use Prisma migrations. Schema changes ship as SQL files here.

## Rules

- Files run in name order. When several share a date, they carry a number (`2026-10-10-01-…`).
- Every file is additive (no `DROP` of data) and idempotent (`IF NOT EXISTS`, `DO $$ … duplicate_object`). Running a file twice must be a no-op.
- `OPCIONAL-*.sql` files are never run automatically. Read them and decide.
- **Never run `prisma db push` against production.** The database still holds the old Airbnb tables (`Listing`, `Reservation`) and extra `User` columns that are not in `schema.prisma`, and `db push` would drop them.

## Release to production

1. Back up and stage: `scripts/backup-and-stage.sh "$PROD_URL"`. It writes `backups/<host>-<date>.dump` and restores it into the local `syncro_staging` database. It uses the Postgres 16 tools in Docker, because the Homebrew `pg_dump` (14) cannot dump a newer server.
2. Rehearse on the copy: `scripts/apply-manual-migrations.sh "$STAGING_URL"`, then point a backend at `syncro_staging` and try the app.
3. Check the copy: `npx prisma migrate diff --from-url "$STAGING_URL" --to-schema-datamodel prisma/schema.prisma --script`. The only expected lines are the Airbnb drops listed above.
4. Apply: `BACKUP_FILE=backups/prod-….dump scripts/apply-manual-migrations.sh "$PROD_URL"`
5. Deploy the backend, then the frontend.

## Rehearsal record

2026-10-10: a fresh database with the schema of commit `c685216`, then every `2026-10-*` file applied twice. The result matches `schema.prisma` with no differences.

2026-10-10 (after the gym phases 2–7): same rehearsal with every file up to `2026-10-12-05-gym-face-devices.sql`, applied twice. No differences.
