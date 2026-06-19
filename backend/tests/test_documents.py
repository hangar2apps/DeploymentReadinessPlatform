"""HTTP tests for document ingestion routes.

Covers:
  POST /api/documents — ingest a PDF via JSON base64 or multipart upload
  GET  /api/documents — list ingested documents with chunk counts

rag.ingest_document and rag.list_documents are mocked — no DB or OpenAI required.

Run:
    cd backend
    uv run pytest tests/test_documents.py -v
"""

import base64
from io import BytesIO
from unittest.mock import patch

import pytest

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        # Document routes are provider/commander-guarded; authenticate via the
        # dev-header fallback (see backend/auth.py).
        c.environ_base["HTTP_X_DEV_ROLE"] = "commander"
        yield c


_INGEST_RESULT = {
    "document_id": "doc-abc-123",
    "chunks_created": 5,
    "status": "complete",
}

_VALID_B64 = base64.b64encode(b"fake pdf content").decode()

_DOCUMENT_LIST = [
    {
        "document_id": "d1",
        "filename": "ar40-501.pdf",
        "doc_type": "",
        "chunk_count": 12,
        "ingested_at": "",
    }
]


# ---------------------------------------------------------------------------
# POST /api/documents — JSON base64 path: validation
# ---------------------------------------------------------------------------

class TestIngestJsonValidation:
    def test_missing_filename_returns_400(self, client):
        r = client.post("/api/documents", json={"content": _VALID_B64})
        assert r.status_code == 400
        assert "required" in r.get_json()["error"]

    def test_missing_content_returns_400(self, client):
        r = client.post("/api/documents", json={"filename": "policy.pdf"})
        assert r.status_code == 400
        assert "required" in r.get_json()["error"]

    def test_empty_filename_treated_as_missing(self, client):
        r = client.post("/api/documents", json={"filename": "", "content": _VALID_B64})
        assert r.status_code == 400

    def test_invalid_base64_returns_400(self, client):
        r = client.post("/api/documents", json={"filename": "policy.pdf", "content": "!!!not-base64!!!"})
        assert r.status_code == 400
        assert "base64" in r.get_json()["error"]

    def test_empty_document_bytes_returns_400(self, client):
        # base64 of empty bytes is "" which is falsy — treated as missing content
        empty_b64 = base64.b64encode(b"").decode()
        r = client.post("/api/documents", json={"filename": "policy.pdf", "content": empty_b64})
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/documents — JSON base64 path: success
# ---------------------------------------------------------------------------

class TestIngestJsonSuccess:
    def test_returns_201_with_document_metadata(self, client):
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT):
            r = client.post("/api/documents", json={"filename": "policy.pdf", "content": _VALID_B64})
        assert r.status_code == 201
        data = r.get_json()
        assert data["document_id"] == "doc-abc-123"
        assert data["chunks_created"] == 5
        assert data["status"] == "complete"

    def test_passes_filename_to_rag(self, client):
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT) as mock_ingest:
            client.post("/api/documents", json={"filename": "ar40-501.pdf", "content": _VALID_B64})
        filename, _, _ = mock_ingest.call_args.args
        assert filename == "ar40-501.pdf"

    def test_passes_decoded_bytes_to_rag(self, client):
        raw_bytes = b"pdf content bytes"
        b64 = base64.b64encode(raw_bytes).decode()
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT) as mock_ingest:
            client.post("/api/documents", json={"filename": "doc.pdf", "content": b64})
        _, content, _ = mock_ingest.call_args.args
        assert content == raw_bytes

    def test_passes_doc_type_to_rag(self, client):
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT) as mock_ingest:
            client.post(
                "/api/documents",
                json={"filename": "policy.pdf", "content": _VALID_B64, "doc_type": "POLICY"},
            )
        _, _, doc_type = mock_ingest.call_args.args
        assert doc_type == "POLICY"

    def test_doc_type_defaults_to_empty_string(self, client):
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT) as mock_ingest:
            client.post("/api/documents", json={"filename": "doc.pdf", "content": _VALID_B64})
        _, _, doc_type = mock_ingest.call_args.args
        assert doc_type == ""


# ---------------------------------------------------------------------------
# POST /api/documents — JSON base64 path: error handling
# ---------------------------------------------------------------------------

class TestIngestJsonErrors:
    def test_rag_exception_returns_502(self, client):
        with patch("blueprints.documents.rag.ingest_document", side_effect=RuntimeError("embed failed")):
            r = client.post("/api/documents", json={"filename": "policy.pdf", "content": _VALID_B64})
        assert r.status_code == 502
        assert "ingestion failed" in r.get_json()["error"]

    def test_502_error_includes_original_exception_message(self, client):
        with patch("blueprints.documents.rag.ingest_document", side_effect=RuntimeError("db timeout")):
            r = client.post("/api/documents", json={"filename": "policy.pdf", "content": _VALID_B64})
        assert "db timeout" in r.get_json()["error"]


# ---------------------------------------------------------------------------
# POST /api/documents — multipart upload path
# ---------------------------------------------------------------------------

class TestIngestMultipart:
    def test_multipart_upload_returns_201(self, client):
        data = {"file": (BytesIO(b"fake pdf bytes"), "upload.pdf")}
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT):
            r = client.post("/api/documents", data=data, content_type="multipart/form-data")
        assert r.status_code == 201

    def test_multipart_returns_document_metadata(self, client):
        data = {"file": (BytesIO(b"fake pdf bytes"), "upload.pdf")}
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT):
            r = client.post("/api/documents", data=data, content_type="multipart/form-data")
        assert r.get_json()["document_id"] == "doc-abc-123"

    def test_uses_original_upload_filename(self, client):
        data = {"file": (BytesIO(b"pdf bytes"), "training_policy.pdf")}
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT) as mock_ingest:
            client.post("/api/documents", data=data, content_type="multipart/form-data")
        filename, _, _ = mock_ingest.call_args.args
        assert filename == "training_policy.pdf"

    def test_empty_multipart_file_returns_400(self, client):
        data = {"file": (BytesIO(b""), "empty.pdf")}
        with patch("blueprints.documents.rag.ingest_document", return_value=_INGEST_RESULT):
            r = client.post("/api/documents", data=data, content_type="multipart/form-data")
        assert r.status_code == 400
        assert "empty" in r.get_json()["error"]

    def test_multipart_rag_exception_returns_502(self, client):
        data = {"file": (BytesIO(b"pdf bytes"), "doc.pdf")}
        with patch("blueprints.documents.rag.ingest_document", side_effect=RuntimeError("parse error")):
            r = client.post("/api/documents", data=data, content_type="multipart/form-data")
        assert r.status_code == 502
        assert "ingestion failed" in r.get_json()["error"]


# ---------------------------------------------------------------------------
# GET /api/documents — list
# ---------------------------------------------------------------------------

class TestListDocuments:
    def test_returns_200_with_document_list(self, client):
        with patch("blueprints.documents.rag.list_documents", return_value=_DOCUMENT_LIST):
            r = client.get("/api/documents")
        assert r.status_code == 200
        assert r.get_json() == _DOCUMENT_LIST

    def test_returns_empty_list_when_no_documents_ingested(self, client):
        with patch("blueprints.documents.rag.list_documents", return_value=[]):
            r = client.get("/api/documents")
        assert r.status_code == 200
        assert r.get_json() == []

    def test_rag_exception_returns_502(self, client):
        with patch("blueprints.documents.rag.list_documents", side_effect=RuntimeError("db down")):
            r = client.get("/api/documents")
        assert r.status_code == 502
        assert "could not list documents" in r.get_json()["error"]