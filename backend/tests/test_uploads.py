"""Upload validation tests — pure sniffing + request validation (no storage)."""

import io

from app import app as flask_app
from blueprints.uploads import _sniff

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPG = b"\xff\xd8\xff" + b"\x00" * 16
PDF = b"%PDF-1.4\n" + b"\x00" * 16


def _client():
    flask_app.config.update(TESTING=True)
    return flask_app.test_client()


def test_sniff_known_types():
    assert _sniff(PNG) == ("png", "image/png")
    assert _sniff(JPG) == ("jpg", "image/jpeg")
    assert _sniff(PDF) == ("pdf", "application/pdf")


def test_sniff_rejects_unknown_and_empty():
    assert _sniff(b"not a real file") is None
    assert _sniff(b"") is None


def test_unknown_record_type_404():
    r = _client().post("/api/uploads/bogus", data={"member_id": "sm-1"})
    assert r.status_code == 404


def test_member_id_traversal_rejected_400():
    data = {"member_id": "../etc", "file": (io.BytesIO(PNG), "x.png")}
    r = _client().post(
        "/api/uploads/immunization", data=data, content_type="multipart/form-data"
    )
    assert r.status_code == 400


def test_unsupported_file_type_415():
    data = {"member_id": "sm-1", "file": (io.BytesIO(b"plain text"), "x.txt")}
    r = _client().post(
        "/api/uploads/immunization", data=data, content_type="multipart/form-data"
    )
    assert r.status_code == 415
