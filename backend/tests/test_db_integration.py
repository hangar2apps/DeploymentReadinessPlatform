"""Integration tests — hit the real Supabase database.

All tests are marked @pytest.mark.db and are skipped automatically when
SUPABASE_CONNECTION_STRING is not set or the connection fails.

Run (from backend/):
    uv run pytest tests/test_db_integration.py -v -m db

Requires a working SUPABASE_CONNECTION_STRING in the root .env.
See docs/testing-backend-assessments.md for the session-pooler setup note.
"""

import os
import pytest
import db
from app import create_app

pytestmark = pytest.mark.db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def require_db():
    """Skip the entire module when the DB connection string is absent or unreachable."""
    if not os.environ.get("SUPABASE_CONNECTION_STRING"):
        pytest.skip("SUPABASE_CONNECTION_STRING not set — skipping DB integration tests")
    try:
        db.query("SELECT 1")
    except Exception as exc:
        pytest.skip(f"DB unreachable: {exc}")


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.fixture
def cleanup_assessments():
    """Collect assessment IDs created during a test and delete them on teardown."""
    ids = []
    yield ids
    for aid in ids:
        try:
            db.execute("DELETE FROM assessments WHERE id = %s", (aid,), returning=False)
        except Exception:
            pass


@pytest.fixture(scope="session")
def live_service_member_id():
    """Return the first service member ID from the live seed data."""
    rows = db.query("SELECT id FROM service_members LIMIT 1")
    if not rows:
        pytest.skip("No service members in DB — load seed data first")
    return str(rows[0]["id"])


# ---------------------------------------------------------------------------
# GET /api/assessments
# ---------------------------------------------------------------------------

class TestListAssessmentsLive:
    def test_returns_200_and_list(self, client):
        r = client.get("/api/assessments")
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)

    def test_response_shape_has_nested_member_and_unit(self, client):
        data = client.get("/api/assessments").get_json()
        if not data:
            pytest.skip("No assessments in DB")
        first = data[0]
        assert "member" in first, "expected nested 'member' key"
        assert "unit" in first, "expected nested 'unit' key"
        assert "flags" in first, "expected 'flags' key (not 'red_flags')"
        assert "id" in first["member"]
        assert "id" in first["unit"]

    def test_filter_by_status(self, client):
        r = client.get("/api/assessments?status=SUBMITTED")
        assert r.status_code == 200
        for row in r.get_json():
            assert row["status"] == "SUBMITTED"

    def test_filter_by_type(self, client):
        r = client.get("/api/assessments?type=PRE")
        assert r.status_code == 200
        for row in r.get_json():
            assert row["type"] == "PRE"


# ---------------------------------------------------------------------------
# GET /api/assessments/:id
# ---------------------------------------------------------------------------

class TestGetAssessmentLive:
    def test_known_assessment_returns_200(self, client):
        all_rows = client.get("/api/assessments").get_json()
        if not all_rows:
            pytest.skip("No assessments in DB")
        aid = all_rows[0]["id"]
        r = client.get(f"/api/assessments/{aid}")
        assert r.status_code == 200
        data = r.get_json()
        assert data["id"] == aid
        assert "member" in data
        assert "unit" in data
        assert "flags" in data

    def test_unknown_id_returns_404(self, client):
        r = client.get("/api/assessments/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/assessments — creates real rows, cleaned up by fixture
# ---------------------------------------------------------------------------

class TestCreateAssessmentLive:
    def test_clean_assessment_creates_no_flags(self, client, live_service_member_id, cleanup_assessments):
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {
                "dental_class": 1,
                "immunizations_current": True,
                "pregnancy": False,
                "new_medication": False,
            },
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        assert data["red_flags"] == []

    def test_dental_class_3_creates_high_flag(self, client, live_service_member_id, cleanup_assessments):
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 3},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        assert "DENTAL_CLASS_3" in types

    def test_phq9_elevated_creates_behavioral_health_flag(self, client, live_service_member_id, cleanup_assessments):
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "POST",
            "status": "SUBMITTED",
            "responses": {
                **{f"phq9_q{i}": 2 for i in range(1, 9)},
                "phq9_q9": 0,
            },
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        assert "PHQ9_ELEVATED" in types

    def test_draft_status_skips_rule_engine(self, client, live_service_member_id, cleanup_assessments):
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "DRAFT",
            "responses": {"dental_class": 4},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        assert data["red_flags"] == []