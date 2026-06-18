"""
Supabase Storage helper — minimal REST upload using the service-role key.

Server-side only (keeps storage creds off the client and files out of the DB,
consistent with the frontend -> gateway -> storage flow). Stdlib only.
"""

import logging
import urllib.error
import urllib.request
from urllib.parse import quote

import config

_log = logging.getLogger(__name__)


class StorageError(Exception):
    pass


def upload_object(path: str, data: bytes, content_type: str) -> str:
    """Upload bytes to {SUPABASE_BUCKET}/{path}; upserts. Returns the path."""

    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        _log.error("storage not configured: SUPABASE_URL / SERVICE_ROLE_KEY missing")
        raise StorageError("storage unavailable")

    obj = quote(f"{config.SUPABASE_BUCKET}/{path}", safe="/")
    url = f"{config.SUPABASE_URL}/storage/v1/object/{obj}"
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120):
            pass
    except urllib.error.HTTPError as e:
        # Log the storage detail server-side; don't leak it to the client.
        detail = e.read().decode("utf-8", "ignore")[:500]
        _log.warning("storage upload failed: HTTP %s %s", e.code, detail)
        raise StorageError("upload failed") from e
    except urllib.error.URLError as e:
        _log.warning("storage unreachable: %s", e.reason)
        raise StorageError("storage unavailable") from e

    return path
