"""
Policy-document routes (formerly the gRPC DocumentIntelligenceServicer).

  POST /api/documents   — ingest a PDF: chunk, embed, store in pgvector
  GET  /api/documents   — list ingested documents with chunk counts

Ingest accepts a base64-encoded PDF in JSON (matching the original DocIntel
contract) or a multipart file upload under the `file` field.
"""

import base64
import binascii
from typing import Tuple
from flask import Blueprint, request, jsonify
from flask.wrappers import Response

bp = Blueprint("documents", __name__, url_prefix="/api/documents")


@bp.post("")
def ingest() -> Tuple[Response, int]:
    """
    Ingest a PDF. Returns {document_id, chunks_created, status}.
    """

    filename = ""
    doc_type = ""
    content: bytes

    # Multipart upload (file field) or JSON with base64 content.
    if "file" in request.files:
        upload = request.files["file"]
        filename = upload.filename or "upload.pdf"
        doc_type = request.form.get("doc_type", "")
        content = upload.read()
    else:
        body = request.get_json(silent=True) or {}
        filename = (body.get("filename") or "").strip()
        doc_type = body.get("doc_type", "")
        b64 = body.get("content")
        if not filename or not b64:
            return jsonify({"error": "filename and content are required"}), 400
        try:
            content = base64.b64decode(b64)
        except (binascii.Error, ValueError):
            return jsonify({"error": "content must be valid base64"}), 400

    if not content:
        return jsonify({"error": "empty document"}), 400

    import rag

    try:
        result = rag.ingest_document(filename, content, doc_type)
    except Exception as e:  # DB or OpenAI unreachable, or unreadable PDF
        return jsonify({"error": f"ingestion failed: {e}"}), 502
    return jsonify(result), 201


@bp.get("")
def list_documents() -> Tuple[Response, int]:
    """
    List ingested documents.
    """

    import rag

    try:
        documents = rag.list_documents()
    except Exception as e:
        return jsonify({"error": f"could not list documents: {e}"}), 502
    return jsonify(documents), 200
