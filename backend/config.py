"""Configuration — loads the shared root .env and exposes settings."""

import os
from pathlib import Path

from dotenv import load_dotenv

_HERE = Path(__file__).resolve().parent

# The whole repo shares one .env at the root (see CLAUDE_CODE_BUILD.md).
_ROOT_ENV = _HERE.parent / ".env"
load_dotenv(_ROOT_ENV, override=False)


# --- Database (Supabase Postgres) ---
# The root .env ships a full connection string. psycopg2 accepts it directly as a DSN.
SUPABASE_CONNECTION_STRING = os.environ.get("SUPABASE_CONNECTION_STRING", "")

# --- Supabase Storage (service-member record uploads) ---
# Server-side bucket writes need the service-role key (not the publishable key).
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "member-records")
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB (Supabase per-file limit)

# --- OpenAI (commander data-chat LLM + policy-assistant RAG) ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# --- Server ---
HOST = os.environ.get("BACKEND_HOST", "127.0.0.1")
PORT = int(os.environ.get("BACKEND_PORT", "3000"))
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
DEBUG = os.environ.get("BACKEND_DEBUG", "").lower() in ("1", "true", "yes", "on")

# --- Auth (UDS Authservice + Keycloak) ---
# Authservice forwards the validated Keycloak ID token here. The header is
# configurable so a different Authservice build (or a proxy that renames it) is
# a one-line change. See auth.py for the trust model.
AUTH_HEADER = os.environ.get("AUTH_HEADER", "Authorization")

# Authorization roles are owned by the roster DB (member_roles), resolved from the
# JWT's `edipi` claim — not from Keycloak groups. See auth.py / docs/configuration.md.

# Local-dev identity fallback, only consulted when DEBUG is on and no JWT is
# present (i.e. running without Authservice in front). DEV_ROLE empty => the
# backend treats unauthenticated dev requests as anonymous (401). For multiple
# roles use a comma-separated X-Dev-Roles header per request.
DEV_ROLE = os.environ.get("DEV_ROLE", "")
DEV_EDIPI = os.environ.get("DEV_EDIPI", "")

# --- Static SPA ---
# Directory holding the built React app (frontend/dist). The container image copies the build here; locally it usually doesn't exist (run Vite separately).
# A str env override is wrapped so STATIC_DIR is always a Path.
STATIC_DIR = Path(os.environ.get("STATIC_DIR", _HERE / "static"))
