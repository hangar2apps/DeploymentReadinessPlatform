"""
Asset upload routes.

  POST /api/uploads/<record_type> — store a service-member record file in the
  Supabase bucket at <member_id>/<record_type>/<uuid>.<ext>; returns
  { path, bucket, record_type }.

The member id namespaces the file; the record type scales to immunization,
dental, vision, etc. and lets a provider list one member's records by prefix.
"""

import re
import uuid
from typing import Optional, Tuple
from flask import Blueprint, request, jsonify
from flask.wrappers import Response

import config
import storage

bp = Blueprint("uploads", __name__, url_prefix="/api/uploads")

_RECORD_TYPES = {"immunization", "dental", "vision", "medical", "other"}
# Allow only safe path-segment chars; blocks traversal (`..`, `/`) in the key.
_MEMBER_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _sniff(data: bytes) -> Optional[Tuple[str, str]]:
    """Identify the file by magic bytes -> (ext, content_type), or None.

    Content sniffing rather than the client-supplied mimetype, so a non-image
    can't be smuggled in with a forged Content-Type.
    """
    if data[:3] == b"\xff\xd8\xff":
        return "jpg", "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png", "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    if data[4:8] == b"ftyp" and data[8:12] in (b"heic", b"heix", b"mif1", b"heif"):
        return "heic", "image/heic"
    if data[:5] == b"%PDF-":
        return "pdf", "application/pdf"
    return None


@bp.post("/<record_type>")
def upload(record_type: str) -> Tuple[Response, int]:
    # Cap body size for this route only (a global MAX_CONTENT_LENGTH would also
    # throttle policy-doc ingest). Enforced when request.files is parsed below.
    request.max_content_length = config.MAX_UPLOAD_BYTES
    if record_type not in _RECORD_TYPES:
        return jsonify({"error": f"unknown record type: {record_type}"}), 404
    if "file" not in request.files:
        return jsonify({"error": "file is required (multipart field 'file')"}), 400
    member_id = (request.form.get("member_id") or "").strip()
    if not _MEMBER_ID.match(member_id):
        return jsonify({"error": "invalid member_id"}), 400

    # MAX_CONTENT_LENGTH (app config) already rejected oversized bodies pre-read.
    data = request.files["file"].read()
    if not data:
        return jsonify({"error": "empty file"}), 400
    if len(data) > config.MAX_UPLOAD_BYTES:
        return jsonify({"error": "file too large (max 50 MB)"}), 413

    sniffed = _sniff(data)
    if not sniffed:
        return jsonify({"error": "unsupported file type"}), 415
    ext, content_type = sniffed

    path = f"{member_id}/{record_type}/{uuid.uuid4().hex}.{ext}"
    try:
        storage.upload_object(path, data, content_type)
    except storage.StorageError as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"path": path, "bucket": config.SUPABASE_BUCKET, "record_type": record_type}), 201
