"""Configuration — loads the shared root .env and exposes settings."""

import os
from dotenv import load_dotenv

# The whole repo shares one .env at the root (see CLAUDE_CODE_BUILD.md).
_ROOT_ENV = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_ROOT_ENV, override=False)


# --- Database (Supabase Postgres) ---
# The root .env ships a full connection string. psycopg2 accepts it directly as a DSN.
SUPABASE_CONNECTION_STRING = os.environ.get("SUPABASE_CONNECTION_STRING", "")

# --- OpenAI (commander data-chat LLM + policy-assistant RAG) ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

# --- Server ---
HOST = os.environ.get("BACKEND_HOST", "127.0.0.1")
PORT = int(os.environ.get("BACKEND_PORT", "3000"))
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
DEBUG = os.environ.get("BACKEND_DEBUG", "").lower() in ("1", "true", "yes", "on")
