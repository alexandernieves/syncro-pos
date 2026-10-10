#!/usr/bin/env python3
"""Turns `prisma migrate diff --script` output into an additive, idempotent migration.

    npx prisma migrate diff --from-url "$LOCAL" --to-schema-datamodel prisma/schema.prisma --script \
      | python3 scripts/make-idempotent.py "Title of the change" > prisma/manual-migrations/<date>-<name>.sql

Drops (tables, columns, constraints) are refused, except constraints that are re-added in the same
script (Prisma does that to change ON DELETE). Old Airbnb leftovers are skipped on purpose.
"""
import re
import sys

LEGACY = re.compile(r'"(Listing|Reservation)"|"User" DROP|DROP COLUMN "(bio|hashedPassword|image|phoneNumber)"')

def statements(sql):
    out, cur = [], []
    for line in sql.splitlines():
        if line.startswith('--') or not line.strip():
            continue
        cur.append(line)
        if line.rstrip().endswith(';'):
            out.append('\n'.join(cur)); cur = []
    return out

def main():
    title = sys.argv[1] if len(sys.argv) > 1 else 'Schema change'
    stmts = [s for s in statements(sys.stdin.read()) if not LEGACY.search(s)]
    readded = {m.group(1) for s in stmts for m in [re.search(r'ADD CONSTRAINT "([^"]+)"', s)] if m}
    print(f'-- {title}\n-- Additive only. Safe to run more than once.')
    for s in stmts:
        if re.match(r'ALTER TABLE "[^"]+" DROP CONSTRAINT "([^"]+)"', s):
            name = re.search(r'DROP CONSTRAINT "([^"]+)"', s).group(1)
            if name not in readded:
                sys.exit(f'Refusing to drop constraint {name}')
            s = s.replace('DROP CONSTRAINT', 'DROP CONSTRAINT IF EXISTS')
        elif re.search(r'\bDROP (TABLE|COLUMN|INDEX)\b', s):
            sys.exit(f'Refusing destructive statement:\n{s}')
        elif s.startswith('CREATE TABLE "'):
            s = s.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "', 1)
        elif re.match(r'CREATE (UNIQUE )?INDEX "', s):
            s = re.sub(r'INDEX "', 'INDEX IF NOT EXISTS "', s, 1)
        elif 'ADD CONSTRAINT' in s:
            s = f'DO $$ BEGIN\n  {s}\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;'
        elif s.startswith('ALTER TABLE'):
            s = re.sub(r'ADD COLUMN(\s+)"', r'ADD COLUMN IF NOT EXISTS "', s)
        print('\n' + s)

main()
