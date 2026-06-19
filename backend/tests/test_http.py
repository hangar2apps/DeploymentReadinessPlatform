"""HTTP layer tests — uses Flask's test client, no real database required.

Covers: health endpoint, input validation (400 errors), routing for all
assessment and service-member paths. Any test that needs the DB is skipped
automatically when SUPABASE_CONNECTION_STRING is unset or the connection fails.

Run:
    cd backend
    uv run pytest tests/test_http.py -v

Run only the no-DB tests:
    uv run pytest tests/test_http.py -v -m "not db"
"""

import contextlib
import os
import pytest
from unittest.mock import patch, MagicMock

from app import create_app


def _fake_transaction(row):
    """A db.transaction() stand-in whose cursor returns `row` from fetchone()."""

    class _Cur:
        def execute(self, sql, params=None):
            pass

        def fetchone(self):
            return dict(row)

        def fetchall(self):
            return []

    @contextlib.contextmanager
    def _cm():
        yield _Cur()

    return _cm


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# Routes are guarded by auth.require_role (see backend/auth.py). Under TESTING the
# backend honors X-Dev-* headers as the caller's identity; set them on the test
# client's environ_base so every request in a class authenticates as the right role.
# (HTTP_<NAME> is how WSGI surfaces request headers.)
SOLDIER_ID = "00000000-0000-0000-0000-000000000001"


def _auth_as(client, role, member_id=None):
    client.environ_base["HTTP_X_DEV_ROLE"] = role
    if member_id is not None:
        client.environ_base["HTTP_X_DEV_MEMBER_ID"] = member_id


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_ok(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200

    def test_response_shape(self, client):
        data = client.get("/api/health").get_json()
        assert data["status"] == "ok"
        assert data["service"] == "drp-backend"


# ---------------------------------------------------------------------------
# POST /api/assessments — input validation (no DB)
# ---------------------------------------------------------------------------

class TestCreateAssessmentValidation:
    @pytest.fixture(autouse=True)
    def _auth(self, client):
        # Soldier role; member id matches the "some-uuid" used by the valid-types
        # test so require_self passes and the request reaches the DB layer.
        _auth_as(client, "service_member", member_id="some-uuid")

    def test_missing_service_member_id_returns_400(self, client):
        r = client.post("/api/assessments",
                        json={"type": "PRE", "responses": {}})
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_missing_type_returns_400(self, client):
        r = client.post("/api/assessments",
                        json={"service_member_id": "some-uuid", "responses": {}})
        assert r.status_code == 400

    def test_invalid_type_returns_400(self, client):
        r = client.post("/api/assessments",
                        json={"service_member_id": "some-uuid", "type": "INVALID"})
        assert r.status_code == 400

    def test_empty_body_returns_400(self, client):
        r = client.post("/api/assessments",
                        data="", content_type="application/json")
        assert r.status_code == 400

    @pytest.mark.parametrize("valid_type", ["PRE", "POST", "PDHRA"])
    def test_valid_types_pass_validation(self, client, valid_type):
        # Validation passes → code reaches the DB. Mock the DB so the request
        # completes cleanly and we can assert the status is not 400.
        with patch("db.execute", return_value=dict(_FAKE_ASSESSMENT)), \
             patch("db.query", return_value=[]):
            r = client.post("/api/assessments",
                            json={"service_member_id": "some-uuid", "type": valid_type})
        assert r.status_code != 400, f"Type {valid_type} should pass validation"


# ---------------------------------------------------------------------------
# PATCH /api/assessments/:id/refer — input validation (no DB)
# ---------------------------------------------------------------------------

class TestReferValidation:
    @pytest.fixture(autouse=True)
    def _auth(self, client):
        _auth_as(client, "provider")

    def test_missing_referral_type_returns_400(self, client):
        r = client.patch(
            "/api/assessments/00000000-0000-0000-0000-000000000001/refer",
            json={},
        )
        assert r.status_code == 400
        assert r.get_json()["error"] == "referral_type is required"

    def test_missing_body_returns_400(self, client):
        r = client.patch(
            "/api/assessments/00000000-0000-0000-0000-000000000001/refer",
            data="", content_type="application/json",
        )
        assert r.status_code == 400

    def test_valid_referral_type_passes_validation(self, client):
        with patch("db.transaction", _fake_transaction(_FAKE_ASSESSMENT)), \
             patch("db.query", return_value=[]):
            r = client.patch(
                "/api/assessments/00000000-0000-0000-0000-000000000001/refer",
                json={"referral_type": "BEHAVIORAL_HEALTH"},
            )
        assert r.status_code != 400


# ---------------------------------------------------------------------------
# Route existence checks — all paths return something (not 404/405)
# ---------------------------------------------------------------------------

class TestRouteRegistration:
    """Verify every route in backend-assessments.md is registered.

    Mock db.query / db.query_one / db.execute so requests complete cleanly
    without a real DB connection. A 404 or 405 means the route is missing.
    """

    @pytest.fixture(autouse=True)
    def mock_db(self):
        # query_one must return a non-None row so detail handlers don't 404.
        with patch("db.query", return_value=[]), \
             patch("db.query_one", side_effect=lambda *a, **kw: dict(_FAKE_ASSESSMENT)), \
             patch("db.execute", side_effect=lambda *a, **kw: dict(_FAKE_ASSESSMENT)), \
             patch("db.transaction", _fake_transaction(_FAKE_ASSESSMENT)):
            yield

    def test_get_assessments_route_exists(self, client):
        r = client.get("/api/assessments")
        assert r.status_code not in (404, 405)

    def test_get_assessment_detail_route_exists(self, client):
        r = client.get("/api/assessments/00000000-0000-0000-0000-000000000001")
        assert r.status_code not in (404, 405)

    def test_post_assessments_route_exists(self, client):
        r = client.post("/api/assessments",
                        json={"service_member_id": "some-uuid", "type": "PRE"})
        assert r.status_code not in (404, 405)

    def test_patch_certify_route_exists(self, client):
        r = client.patch(
            "/api/assessments/00000000-0000-0000-0000-000000000001/certify",
            json={},
        )
        assert r.status_code not in (404, 405)

    def test_patch_refer_route_exists(self, client):
        r = client.patch(
            "/api/assessments/00000000-0000-0000-0000-000000000001/refer",
            json={"referral_type": "DENTAL"},
        )
        assert r.status_code not in (404, 405)

    def test_get_service_members_route_exists(self, client):
        r = client.get("/api/service-members")
        assert r.status_code not in (404, 405)

    def test_get_service_member_detail_route_exists(self, client):
        r = client.get("/api/service-members/00000000-0000-0000-0000-000000000001")
        assert r.status_code not in (404, 405)


# ---------------------------------------------------------------------------
# POST /api/assessments — rule engine fires and response includes flags
# (mocks the DB write so no connection needed)
# ---------------------------------------------------------------------------

_FAKE_ASSESSMENT = {
    # Assessment columns
    "id": "00000000-0000-0000-0000-000000000099",
    "service_member_id": "00000000-0000-0000-0000-000000000001",
    "type": "PRE",
    "status": "SUBMITTED",
    "responses": {},
    "phq9_score": 14,
    "pcl5_score": 0,
    "submitted_at": "2026-06-17T00:00:00Z",
    "certified_at": None,
    "certified_by": None,
    "referral_type": None,
    "referral_notes": None,
    # JOIN columns from _BASE_SELECT (service_members + units)
    "rank": "SPC",
    "last_name": "Doe",
    "first_name": "Jane",
    "edipi": "9000000001",
    "middle_initial": None,
    "mos": "11B",
    "sm_deployable": True,
    "sm_deployable_reason": None,
    "unit_id": "00000000-0000-0000-0000-000000000010",
    "unit_name": "Test Company",
    "unit_short_name": "T CO",
    "unit_uic": "WJ5TT0",
    "unit_parent_id": None,
}


class TestCreateAssessmentRuleEngine:
    """Submit assessments with a mocked DB and verify flags come back."""

    @pytest.fixture(autouse=True)
    def _auth(self, client):
        # Soldier submitting their own record (member id matches the posted id).
        _auth_as(client, "service_member", member_id=SOLDIER_ID)

    @pytest.fixture(autouse=True)
    def mock_db(self):
        # create_assessment now runs inside db.transaction(); fake the cursor so
        # fetchone() returns shaped rows based on the last statement executed.
        import contextlib

        class FakeCursor:
            def __init__(self):
                self._sql = ""
                self._params = None

            def execute(self, sql, params=None):
                self._sql = sql
                self._params = params

            def fetchone(self):
                sql, params = self._sql, self._params
                # Red-flag INSERT: params (assessment_id, type, severity, rule_fired, message).
                if "INSERT INTO red_flags" in sql and params and len(params) >= 3:
                    return {
                        "id": "rf-test",
                        "assessment_id": params[0],
                        "type": params[1],
                        "severity": params[2],
                        "rule_fired": params[3] if len(params) > 3 else "",
                        "message": params[4] if len(params) > 4 else "",
                        "resolved_at": None,
                    }
                # Assessment INSERT.
                return dict(_FAKE_ASSESSMENT)

            def fetchall(self):
                return []

        @contextlib.contextmanager
        def fake_transaction():
            yield FakeCursor()

        with patch("db.transaction", fake_transaction), \
             patch("db.query", return_value=[]):
            yield

    def test_dental_class_3_returns_high_flag(self, client, mock_db):
        r = client.post("/api/assessments", json={
            "service_member_id": "00000000-0000-0000-0000-000000000001",
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 3},
        })
        assert r.status_code == 201
        data = r.get_json()
        assert "red_flags" in data
        types = [f["type"] for f in data["red_flags"]]
        assert "DENTAL_CLASS_3" in types

    def test_pregnancy_returns_high_flag(self, client, mock_db):
        r = client.post("/api/assessments", json={
            "service_member_id": "00000000-0000-0000-0000-000000000001",
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"pregnancy": True},
        })
        assert r.status_code == 201
        data = r.get_json()
        types = [f["type"] for f in data["red_flags"]]
        assert "PREGNANCY" in types

    def test_draft_status_skips_rule_engine(self, client, mock_db):
        r = client.post("/api/assessments", json={
            "service_member_id": "00000000-0000-0000-0000-000000000001",
            "type": "PRE",
            "status": "DRAFT",
            "responses": {"dental_class": 4},
        })
        assert r.status_code == 201
        data = r.get_json()
        assert data["red_flags"] == []

    def test_clean_assessment_returns_no_flags(self, client, mock_db):
        r = client.post("/api/assessments", json={
            "service_member_id": "00000000-0000-0000-0000-000000000001",
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
        assert data["red_flags"] == []
