#!/usr/bin/env python3
"""Generate members.auto.tfvars.json from the roster seed.

Parses the service_members VALUES block in db/seed/seed.sql and emits the
Keycloak user list consumed by main.tf (var.members). Re-run whenever the seed
roster changes:

    python3 tofu/keycloak/generate_members.py

Only identity fields are emitted (edipi, name, email) — roles are NOT here. Who
is a provider/commander is owned by the roster DB (member_roles), not Keycloak.
The email matches the derivation in seed.sql: first.last.edipi@army.mil.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "db" / "seed" / "seed.sql"
OUT = Path(__file__).resolve().parent / "members.auto.tfvars.json"

# One service_members VALUES row:
#   ('1000000001','LTC','Harris','Robert','J','11A','WJ5THH', true, NULL),
ROW = re.compile(
    r"\(\s*'(?P<edipi>\d{10})'\s*,"
    r"\s*'(?P<rank>[^']*)'\s*,"
    r"\s*'(?P<last>[^']*)'\s*,"
    r"\s*'(?P<first>[^']*)'\s*,"
    r"\s*'(?P<mi>[^']*)'\s*,"
    r"\s*'(?P<mos>[^']*)'\s*,"
    r"\s*'(?P<uic>[^']*)'\s*,"
    r"\s*(?P<dep>true|false)\s*,"
)


def main() -> None:
    text = SEED.read_text()
    # Scope to the service_members VALUES block so we don't match other tuples.
    start = text.index("INSERT INTO service_members")
    block = text[start : text.index(") AS v(", start)]

    members = []
    seen = set()
    for m in ROW.finditer(block):
        edipi = m["edipi"]
        if edipi in seen:
            continue
        seen.add(edipi)
        first, last = m["first"], m["last"]
        members.append(
            {
                "edipi": edipi,
                "rank": m["rank"],
                "first_name": first,
                "last_name": last,
                "email": f"{first.lower()}.{last.lower()}.{edipi}@army.mil",
            }
        )

    OUT.write_text(json.dumps({"members": members}, indent=2) + "\n")
    print(f"Wrote {len(members)} members to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
