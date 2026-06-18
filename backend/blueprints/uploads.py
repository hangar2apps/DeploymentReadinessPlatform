"""
Asset upload routes.

  POST /api/uploads/<record_type> — store a service-member record file in the
  Supabase bucket at <member_id>/<record_type>/<uuid>.<ext>; returns
  { path, bucket, record_type }.

The member id namespaces the file; the record type scales to immunization,
dental, vision, etc. and lets a provider list one member's records by prefix.
"""

import uuid
from typing import Tuple
from flask import Blueprint, request, jsonify
from flask.wrappers import Response

import config
import storage

bp = Blueprint("uploads", __name__, url_prefix="/api/uploads")

_RECORD_TYPES = {"immunization", "dental", "vision", "medical", "other"}

_ALLOWED = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
}
_MAX_BYTES = 50 * 1024 * 1024  # 50 MB (Supabase per-file limit)


@bp.post("/<record_type>")
def upload(record_type: str) -> Tuple[Response, int]:
    if record_type not in _RECORD_TYPES:
        return jsonify({"error": f"unknown record type: {record_type}"}), 404
    if "file" not in request.files:
        return jsonify({"error": "file is required (multipart field 'file')"}), 400
    upload_file = request.files["file"]
    member_id = (request.form.get("member_id") or "").strip()
    if not member_id:
        return jsonify({"error": "member_id is required"}), 400

    content_type = upload_file.mimetype or ""
    ext = _ALLOWED.get(content_type)
    if not ext:
        return jsonify({"error": f"unsupported file type: {content_type or 'unknown'}"}), 415

    data = upload_file.read()
    if not data:
        return jsonify({"error": "empty file"}), 400
    if len(data) > _MAX_BYTES:
        return jsonify({"error": "file too large (max 50 MB)"}), 413

    path = f"{member_id}/{record_type}/{uuid.uuid4().hex}.{ext}"
    try:
        storage.upload_object(path, data, content_type)
    except storage.StorageError as e:
        return jsonify({"error": str(e)}), 502
    return jsonify({"path": path, "bucket": config.SUPABASE_BUCKET, "record_type": record_type}), 201
