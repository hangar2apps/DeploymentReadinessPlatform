# syntax=docker/dockerfile:1
#
# Single image for the whole DRP app: the Flask API plus the built React SPA it now serves.
#
# IMPORTANT: build with the DeploymentReadinessPlatform/ directory as context so both backend/ and frontend/ are visible, e.g.:
#   docker build -f backend/Dockerfile -t drp .

# --- Frontend build stage ----------------------------------------------------
# Compile the Vite + React + TS app into static assets.
# Node 22: Vite 8 (see frontend/package.json) requires Node 20.19+ / 22.12+.
FROM node:22-slim AS frontend

WORKDIR /frontend

# Build-time SPA config baked into the bundle:
#   VITE_USE_MOCKS=false — call the real API, not the in-bundle fixtures
#   VITE_API_URL=""       — same-origin: fetch('/api/...') hits this same Flask
#                           app, so no CORS and no backend hostname coupling
ARG VITE_USE_MOCKS=false
ARG VITE_API_URL=""
ENV VITE_USE_MOCKS=$VITE_USE_MOCKS \
    VITE_API_URL=$VITE_API_URL

# Install deps first (own layer) so they only reinstall when manifests change.
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY frontend/ ./
RUN npm run build   # -> /frontend/dist

# --- Backend dependency stage ------------------------------------------------
# Resolve the Python deps into a self-contained virtualenv using uv.
# Use the uv flavor that bundles a shell and a Python interpreter — the bare `uv:latest` image is distroless (only the uv binary, no /bin/sh, no Python), so RUN steps and `uv sync` both fail there. python3.14 here matches the python:3.14 runtime stage below so the copied .venv is interpreter-compatible.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS deps

# uv settings:
#   COMPILE_BYTECODE  — precompile .pyc at build time for faster cold starts
#   LINK_MODE=copy    — copy packages instead of hardlinking across mounts
#   PYTHON_DOWNLOADS  — never fetch a managed Python; use the image's
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Install dependencies first, in their own layer, so they are only re-resolved when the lockfile changes — not on every source edit. The bind mounts keep the manifests out of the layer; the cache mount reuses uv's download cache.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=backend/pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=backend/uv.lock,target=uv.lock \
    uv sync --frozen --no-install-project --no-dev

# --- Runtime stage -----------------------------------------------------------
# A clean Python base without uv or build tooling, for a smaller attack surface.
FROM python:3.14 AS runtime

# Run as an unprivileged user rather than root.
RUN groupadd --system app && useradd --system --gid app --home-dir /app app

WORKDIR /app

# Bring over the fully-built virtualenv from the deps stage.
COPY --from=deps --chown=app:app /app/.venv /app/.venv

# Put the venv first on PATH so `python` resolves to it.
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Backend source. Copied after dependencies so code changes don't bust the dependency layers above.
COPY --chown=app:app backend/ /app

# Built SPA into the dir config.STATIC_DIR points at (backend/static). Flask's catch-all route serves these files and falls back to index.html.
COPY --from=frontend --chown=app:app /frontend/dist /app/static

USER app

# config.py defaults BACKEND_PORT to 3000; expose and bind that.
EXPOSE 3000

# Serve with gunicorn (a production WSGI server) rather than Flask's built-in dev server. app:app is the module-level Flask instance in app.py. JSON/exec form (sh -c) so ${BACKEND_PORT} — the same var config.PORT reads — is still expanded, while `exec` makes gunicorn replace the shell as PID 1 so it receives SIGTERM directly for graceful shutdown under Kubernetes/UDS.
CMD ["/bin/sh", "-c", "exec gunicorn --bind 0.0.0.0:${BACKEND_PORT:-3000} --workers 2 app:app"]
