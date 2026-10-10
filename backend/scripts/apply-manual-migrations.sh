#!/usr/bin/env bash
# Applies backend/prisma/manual-migrations/*.sql in name order, each file in its own transaction.
# Every file is additive and idempotent, so running it again is safe.
#
#   scripts/apply-manual-migrations.sh <database-url> [--from 2026-10-04]
#
# On anything that is not localhost it refuses to run unless BACKUP_FILE points to an
# existing pg_dump of that database made in the last 24 hours.
# OPCIONAL-*.sql files are never applied by this script.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"

URL="${1:?usage: apply-manual-migrations.sh <database-url> [--from YYYY-MM-DD]}"
FROM="${3:-0000}"
[[ "${2:-}" == "--from" ]] || FROM="0000"
DIR="$(cd "$(dirname "$0")/../prisma/manual-migrations" && pwd)"
HOST="$(echo "$URL" | sed -E 's#^[a-z]+://[^@]*@([^:/?]+).*#\1#')"

if [[ "$HOST" != "localhost" && "$HOST" != "127.0.0.1" ]]; then
  if [[ -z "${BACKUP_FILE:-}" || ! -s "$BACKUP_FILE" ]]; then
    echo "Remote database ($HOST): set BACKUP_FILE to a fresh pg_dump first." >&2
    exit 1
  fi
  if [[ -n "$(find "$BACKUP_FILE" -mmin +1440)" ]]; then
    echo "Backup $BACKUP_FILE is older than 24 hours. Make a new one." >&2
    exit 1
  fi
  read -r -p "Apply migrations to $HOST? Type the host to confirm: " answer
  [[ "$answer" == "$HOST" ]] || { echo "Cancelled."; exit 1; }
fi

for f in "$DIR"/20*.sql; do
  name="$(basename "$f")"
  [[ "$name" < "$FROM" ]] && continue
  printf '%-48s' "$name"
  psql "$URL" -v ON_ERROR_STOP=1 -q -1 -f "$f" >/dev/null
  echo "ok"
done
echo "Done. Check with: npx prisma migrate diff --from-url <url> --to-schema-datamodel prisma/schema.prisma --script"
