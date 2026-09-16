#!/usr/bin/env python3
"""Apply pending SQL migrations to the Supabase project through the Management API.

Why not `supabase db push`: that needs the database password. The Management
API's query endpoint needs only an access token, which is the one secret CI
already has for deploying functions.

Which migrations count as pending:
  * version > the one recorded in `supabase/.migration-baseline`  (everything
    at or below it was applied by hand before this script existed), AND
  * version not already present in `supabase_migrations.schema_migrations`
    (the table the Supabase CLI uses, so the two mechanisms stay in agreement).

Each applied migration is recorded in that table. A failure stops the run at
the failing file and exits non-zero; nothing after it is attempted.

Usage:
  python3 scripts/apply-migrations.py           # apply
  python3 scripts/apply-migrations.py --list    # show what would be applied
Env:
  SUPABASE_ACCESS_TOKEN   required to apply; optional for --list
"""
import json, os, re, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "supabase" / "migrations"
BASELINE_FILE = ROOT / "supabase" / ".migration-baseline"
CONFIG = ROOT / "supabase" / "config.toml"
API = "https://api.supabase.com/v1/projects/{ref}/database/query"

def project_ref() -> str:
    m = re.search(r'^project_id\s*=\s*"([^"]+)"', CONFIG.read_text(), re.M)
    if not m:
        sys.exit("supabase/config.toml has no project_id")
    return m.group(1)

def baseline() -> str:
    return BASELINE_FILE.read_text().strip() if BASELINE_FILE.exists() else "0"

def local_migrations():
    out = []
    for p in sorted(MIGRATIONS.glob("*.sql")):
        m = re.match(r"^(\d{14})_?(.*)\.sql$", p.name)
        if m:
            out.append((m.group(1), m.group(2) or p.stem, p))
    return out

def query(ref: str, token: str, sql: str):
    req = urllib.request.Request(
        API.format(ref=ref),
        data=json.dumps({"query": sql}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read().decode()
            return json.loads(body) if body else []
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode()[:800]}") from None

TRACKING_DDL = """
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version    text PRIMARY KEY,
  statements text[],
  name       text
);
"""

def main() -> int:
    list_only = "--list" in sys.argv
    base = baseline()
    pending = [(v, n, p) for v, n, p in local_migrations() if v > base]

    if list_only and not os.environ.get("SUPABASE_ACCESS_TOKEN"):
        # Best effort without a token: cannot consult the remote table.
        for v, n, _ in pending:
            print(f"  {v}  {n}")
        print(f"({len(pending)} newer than baseline {base}; remote state unknown without a token)")
        return 0

    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is not set")

    ref = project_ref()
    query(ref, token, TRACKING_DDL)
    applied = {r["version"] for r in query(ref, token,
               "SELECT version FROM supabase_migrations.schema_migrations")}
    todo = [(v, n, p) for v, n, p in pending if v not in applied]

    print(f"project {ref}: baseline {base}, {len(applied)} recorded remotely, {len(todo)} to apply")
    for v, n, _ in todo:
        print(f"  {v}  {n}")
    if list_only or not todo:
        return 0

    # A run that would apply many files at once is almost always a wrong
    # baseline, not a real backlog. Refuse rather than replay history.
    if len(todo) > 10 and os.environ.get("ALLOW_MANY_MIGRATIONS") != "1":
        sys.exit(f"Refusing to apply {len(todo)} migrations at once. "
                 "Check supabase/.migration-baseline, or set ALLOW_MANY_MIGRATIONS=1.")

    for v, n, p in todo:
        sql = p.read_text()
        print(f"\n==> {p.name}")
        try:
            query(ref, token, sql)
        except RuntimeError as e:
            print(f"::error file={p}::migration failed: {e}")
            print("Stopped. Nothing after this file was attempted.")
            return 1
        query(ref, token,
              "INSERT INTO supabase_migrations.schema_migrations (version, name) "
              f"VALUES ('{v}', '{n.replace(chr(39), chr(39)*2)}') ON CONFLICT (version) DO NOTHING")
        print(f"    applied and recorded {v}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
