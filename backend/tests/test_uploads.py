"""Upload validation tests — pure sniffing + request validation (no storage).

Registers only the uploads blueprint on a bare Flask app so these stay
independent of the rest of create_app() (db, rag/openai imports, etc.).
"""

import io

import pytest
from flask import Flask

from blueprints.uploads import bp as uploads_bp, _sniff

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPG = b"\xff\xd8\xff" + b"\x00" * 16
PDF = b"%PDF-1.4\n" + b"\x00" * 16


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config.update(TESTING=True)
    app.register_blueprint(uploads_bp)
    return app.test_client()


def test_sniff_known_types():
    assert _sniff(PNG) == ("png", "image/png")
    assert _sniff(JPG) == ("jpg", "image/jpeg")
    assert _sniff(PDF) == ("pdf", "application/pdf")


def test_sniff_rejects_unknown_and_empty():
    assert _sniff(b"not a real file") is None
    assert _sniff(b"") is None


def test_unknown_record_type_404(client):
    r = client.post("/api/uploads/bogus", data={"member_id": "sm-1"})
    assert r.status_code == 404


def test_member_id_traversal_rejected_400(client):
    data = {"member_id": "../etc", "file": (io.BytesIO(PNG), "x.png")}
    r = client.post(
        "/api/uploads/immunization", data=data, content_type="multipart/form-data"
    )
    assert r.status_code == 400


def test_unsupported_file_type_415(client):
    data = {"member_id": "sm-1", "file": (io.BytesIO(b"plain text"), "x.txt")}
    r = client.post(
        "/api/uploads/immunization", data=data, content_type="multipart/form-data"
    )
    assert r.status_code == 415
    assert r.get_json()["error"] == "unsupported file type"
