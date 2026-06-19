"""
Thin psycopg2 access layer over the shared Supabase Postgres.

A small connection pool is created once at import. Helpers return rows as plain
dicts (via RealDictCursor) so route handlers can jsonify them directly.
"""

import contextlib
from typing import Any, Generator, Optional, Sequence
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor, RealDictRow
from psycopg2.extensions import connection

import config

_pool: Optional[ThreadedConnectionPool] = None


def _get_pool() -> ThreadedConnectionPool:
    """
    Create the connection pool on first use (keeps app import side-effect free).
    """

    global _pool
    if _pool is None:
        # Supabase requires SSL. The DSN may already include sslmode; if not, force it.
        dsn = config.SUPABASE_CONNECTION_STRING
        if not dsn:
            raise RuntimeError("SUPABASE_CONNECTION_STRING is not set in the root .env")
        if "sslmode=" not in dsn:
            dsn += ("&" if "?" in dsn else "?") + "sslmode=require"
        _pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=dsn)
    return _pool


@contextlib.contextmanager
def get_conn() -> Generator[connection, None, None]:
    """
    Borrow a connection from the pool, returning it on exit.
    """

    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
    finally:
        # Clear the connection's transaction state before returning it to the pool.
        # The read helpers (query/query_one) never commit, so without this a
        # connection goes back either idle-in-transaction or — after a failed
        # statement — ABORTED. A poisoned connection makes the next borrower's
        # unrelated query fail with "current transaction is aborted, commands
        # ignored until end of transaction block". transaction()/execute() have
        # already committed by the time this runs, so the rollback is a no-op for
        # them. Guard it so a broken connection can't mask the original error.
        try:
            conn.rollback()
        except Exception:
            pass
        pool.putconn(conn)


@contextlib.contextmanager
def transaction() -> Generator[RealDictCursor, None, None]:
    """
    Run several statements in ONE transaction. Yields a RealDictCursor; commits
    on clean exit, rolls back on any exception.

    Use when multiple writes must succeed or fail together — e.g. inserting an
    assessment, superseding prior red flags, inserting new ones, and updating
    deployability. Doing those as separate execute() calls would let a partial
    failure leave a soldier mid-update (flags cleared but deployability stale).
    """

    with get_conn() as conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def query(
    sql: str,
    params: Optional[Sequence[Any]] = None,
) -> list[RealDictRow]:
    """
    Run a SELECT and return a list of dict rows.
    """

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params or ())
            return cur.fetchall()


def query_one(
    sql: str,
    params: Optional[Sequence[Any]] = None,
) -> Optional[dict[str, Any]]:
    """
    Run a SELECT and return a single dict row (or None).
    """

    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params or ())
            return cur.fetchone()


def execute(
    sql: str,
    params: Optional[Sequence[Any]] = None,
    returning: bool = True,
) -> Optional[dict[str, Any]]:
    """
    Run an INSERT/UPDATE/DELETE inside a transaction.

    Returns the RETURNING row (dict) when returning=True, else None.
    """

    with get_conn() as conn:
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(sql, params or ())
                row = cur.fetchone() if returning else None
            conn.commit()
            return row
        except Exception:
            conn.rollback()
            raise
