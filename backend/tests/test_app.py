"""Tests for the Flask application factory and SPA catch-all routing.

Covers:
  create_app() — returns a Flask instance with all blueprints registered
  SPA routing  — unknown /api/* paths return JSON 404 (not masked by index.html)
               — route registration for chat and document endpoints

Run:
    cd backend
    uv run pytest tests/test_app.py -v
"""

import pytest
from flask import Flask

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

class TestCreateApp:
    def test_returns_flask_instance(self):
        assert isinstance(create_app(), Flask)

    def test_all_blueprints_registered(self):
        app = create_app()
        names = set(app.blueprints.keys())
        assert "assessments" in names
        assert "service_members" in names
        assert "units" in names
        assert "readiness" in names
        assert "chat" in names
        assert "documents" in names

    def test_multiple_calls_return_independent_instances(self):
        app1 = create_app()
        app2 = create_app()
        assert app1 is not app2


# ---------------------------------------------------------------------------
# SPA catch-all — unknown /api/* paths must NOT fall through to index.html
# ---------------------------------------------------------------------------

class TestSpaRouting:
    def test_unknown_api_path_returns_404_json(self, client):
        r = client.get("/api/no-such-endpoint")
        assert r.status_code == 404
        data = r.get_json()
        assert data is not None
        assert "error" in data

    def test_unknown_api_path_does_not_return_html(self, client):
        r = client.get("/api/not-a-real-route")
        assert "text/html" not in (r.content_type or "")

    def test_deeply_nested_unknown_api_path_returns_404(self, client):
        r = client.get("/api/v1/deep/path/that/does/not/exist")
        assert r.status_code == 404
        assert r.get_json() is not None


# ---------------------------------------------------------------------------
# Route registration smoke-checks for chat and document endpoints
# ---------------------------------------------------------------------------

class TestChatAndDocumentRouteRegistration:
    """Verify the chat and document blueprints are wired up.

    Mocks are minimal — we only care that routes exist (not 404/405), not
    that they return correct data.
    """

    def test_policy_chat_route_exists(self, client):
        r = client.post("/api/policy-chat", json={"question": "test"})
        assert r.status_code not in (404, 405)

    def test_commander_chat_route_exists(self, client):
        r = client.post("/api/commander/chat", json={})
        assert r.status_code not in (404, 405)

    def test_documents_post_route_exists(self, client):
        r = client.post("/api/documents", json={})
        assert r.status_code not in (404, 405)

    def test_documents_get_route_exists(self, client):
        from unittest.mock import patch
        with patch("blueprints.documents.rag.list_documents", return_value=[]):
            r = client.get("/api/documents")
        assert r.status_code not in (404, 405)

    def test_units_list_route_exists(self, client):
        from unittest.mock import patch
        with patch("blueprints.units.db.query", return_value=[]):
            r = client.get("/api/units")
        assert r.status_code not in (404, 405)