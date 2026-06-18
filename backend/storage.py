"""
Supabase Storage helper — minimal REST upload using the service-role key.

Server-side only (keeps storage creds off the client and files out of the DB,
consistent with the frontend -> gateway -> storage flow). Stdlib only.
"""

import urllib.error
import urllib.request

import config


class StorageError(Exception):
    pass


def upload_object(path: str, data: bytes, content_type: str) -> str:
    """Upload bytes to {SUPABASE_BUCKET}/{path}; upserts. Returns the path."""

    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        raise StorageError("storage not configured (SUPABASE_URL / SERVICE_ROLE_KEY missing)")

    url = f"{config.SUPABASE_URL}/storage/v1/object/{config.SUPABASE_BUCKET}/{path}"
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
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status not in (200, 201):
                raise StorageError(f"upload failed: HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")[:200]
        raise StorageError(f"upload failed: HTTP {e.code} {body}") from e
    except urllib.error.URLError as e:
        raise StorageError(f"storage unreachable: {e.reason}") from e

    return path
