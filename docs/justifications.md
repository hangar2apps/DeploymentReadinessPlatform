# Assumptions & justifications

## Image reference: `ghcr.io/defenseunicorns/deployment-readiness-platform:0.1.0`

**Why:** The repo has no published image or registry convention yet. This is a placeholder so the chart, `zarf.yaml` `images:`, and the `build-image` task line up.

## External Supabase Postgres (no in-cluster DB package)

**Why:** `backend/config.py` and `db.py` read a full `SUPABASE_CONNECTION_STRING` DSN and force `sslmode=require` — the app points at hosted Supabase, not an in-cluster service. So the bundle wraps only the DRP package and the egress policy allows outbound Postgres.

## `runAsUser: 1000` set explicitly

**Why:** The image's `USER app` is a *non-numeric* system user. Kubelet cannot verify a non-numeric user is non-root, so with `runAsNonRoot: true` and no numeric `runAsUser` the pod is refused at admission. 1000 is a safe non-root UID; the venv under `/app/.venv` is world-readable/executable, so a UID other than the image's `app` can still run the interpreter. **Confirm** the app starts cleanly as 1000 during the first deploy; if a path needs write access beyond `/tmp`, adjust.

## `readOnlyRootFilesystem: true` + a `/tmp` emptyDir

**Why:** The app does not write to its source tree at runtime (`PYTHONDONTWRITEBYTECODE=1`), so a read-only rootfs is the safer default. gunicorn and some libraries still need a writable `/tmp`, mounted as an emptyDir. If a dependency needs more writable paths, either add mounts or flip the flag in `chart/values.yaml`.

## Egress uses `remoteGenerated: Anywhere`

**Why:** Supabase and OpenAI are public-internet endpoints with rotating IPs, so host-pinned policy is brittle at the package level. Ports are constrained (5432/ 6543, 443). In production the platform egress gateway should narrow these to the specific hostnames.

## No SSO wired (commented in the CR)

**Why:** DRP has no auth code today and no documented identity requirement. The `sso:` block is present but commented so the choice (authservice in front, vs. app-implemented OIDC) is a deliberate, owner-made decision rather than a default.
