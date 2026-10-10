#!/usr/bin/env bash
# Backs up a database and restores the copy into a local staging database.
#
#   scripts/backup-and-stage.sh <source-database-url>
#
# - Writes backups/<host>-<date>.dump (custom format, read-only on the source).
# - Recreates the local database syncro_staging in the syncro-dev-db container (port 5434)
#   from that dump, so migrations can be rehearsed on real data before production.
# Uses the Postgres 16 tools inside Docker, since pg_dump must not be older than the server.
set -euo pipefail

SRC="${1:?usage: backup-and-stage.sh <source-database-url>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/backups"
HOST="$(echo "$SRC" | sed -E 's#^[a-z]+://[^@]*@([^:/?]+).*#\1#')"
FILE="$ROOT/backups/${HOST%%.*}-$(date +%F-%H%M).dump"

echo "Backing up $HOST → $FILE"
docker run --rm -v "$ROOT/backups:/backups" pgvector/pgvector:pg16 \
  pg_dump "$SRC" -Fc --no-owner --no-privileges -f "/backups/$(basename "$FILE")"
ls -lh "$FILE"

echo "Restoring into syncro_staging (local)"
docker exec syncro-dev-db psql -U postgres -q -c 'DROP DATABASE IF EXISTS syncro_staging' -c 'CREATE DATABASE syncro_staging'
docker exec -i syncro-dev-db pg_restore -U postgres -d syncro_staging --no-owner --no-privileges < "$FILE"
docker exec syncro-dev-db psql -U postgres -d syncro_staging -Atc \
  'SELECT count(*) || '"' businesses, '"' || (SELECT count(*) FROM "Sale") || '"' sales'"' FROM "Business"'
echo "Staging ready: postgresql://postgres:<local password>@localhost:5434/syncro_staging"
