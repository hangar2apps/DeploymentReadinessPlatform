"""Integration tests — hit the real Supabase database.

All tests are marked @pytest.mark.db and are skipped automatically when
SUPABASE_CONNECTION_STRING is not set or the connection fails.

Run (from backend/):
    uv run pytest tests/test_db_integration.py -v -m db

Requires a working SUPABASE_CONNECTION_STRING in the root .env.
See docs/testing-backend-assessments.md for the session-pooler setup note.

Coverage:
  - GET  /api/assessments  (list, all three filters)
  - GET  /api/assessments/:id  (detail + 404)
  - POST /api/assessments  (all 10 red-flag rules, deployability side-effect)
  - PATCH /api/assessments/:id/certify  (status, member state, guard)
  - PATCH /api/assessments/:id/refer   (status, member state)
  - GET  /api/service-members  (list, unit_id + deployable filters)
  - GET  /api/service-members/:id  (detail with assessments, 404)
  - Seed acceptance  (>=12 non-deployable soldiers, >=17 red flags)
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
    """Track assessment IDs created during a test and delete them (+ cascaded flags) on teardown."""
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


@pytest.fixture(scope="session")
def live_unit_id():
    """Return the first unit ID from the live seed data."""
    rows = db.query("SELECT id FROM units LIMIT 1")
    if not rows:
        pytest.skip("No units in DB — load seed data first")
    return str(rows[0]["id"])


@pytest.fixture
def sm_state_restore():
    """Generic save/restore for service_member deployable state.

    Call ``save(sm_id)`` at the top of a test to register that SM; the fixture
    restores deployable + deployable_reason for every registered SM on teardown.
    Returns the sm_id so callers can write: ``sm_id = sm_state_restore(sm_id)``
    """
    saved = {}

    def save(sm_id):
        if sm_id not in saved:
            row = db.query_one(
                "SELECT deployable, deployable_reason FROM service_members WHERE id = %s",
                (sm_id,),
            )
            saved[sm_id] = dict(row)
        return sm_id

    yield save

    for sm_id, state in saved.items():
        try:
            db.execute(
                "UPDATE service_members SET deployable = %s, deployable_reason = %s WHERE id = %s",
                (state["deployable"], state["deployable_reason"], sm_id),
                returning=False,
            )
        except Exception:
            pass


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

    def test_filter_by_unit_id(self, client, live_unit_id):
        r = client.get(f"/api/assessments?unit_id={live_unit_id}")
        assert r.status_code == 200
        data = r.get_json()
        if not data:
            pytest.skip("No assessments for this unit")
        for row in data:
            assert row["unit"]["id"] == live_unit_id


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
# POST /api/assessments — all 10 red-flag rules
# ---------------------------------------------------------------------------

class TestCreateAssessmentLive:
    def test_clean_assessment_creates_no_flags(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
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

    def test_dental_class_3_creates_high_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
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

    def test_dental_class_4_creates_high_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 4},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        assert "DENTAL_CLASS_4" in types

    def test_phq9_elevated_creates_high_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "POST",
            "status": "SUBMITTED",
            "responses": {**{f"phq9_q{i}": 2 for i in range(1, 9)}, "phq9_q9": 0},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        assert "PHQ9_ELEVATED" in types

    def test_phq9_mild_creates_low_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        # Score of 6: q1-q2 = 3 each, rest 0
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"phq9_q1": 3, "phq9_q2": 3,
                          **{f"phq9_q{i}": 0 for i in range(3, 10)}},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        severities = {f["type"]: f["severity"] for f in data["red_flags"]}
        assert "PHQ9_MILD" in types
        assert severities["PHQ9_MILD"] == "LOW"
        assert "PHQ9_ELEVATED" not in types

    def test_phq9_self_harm_creates_high_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "POST",
            "status": "SUBMITTED",
            "responses": {**{f"phq9_q{i}": 0 for i in range(1, 10)}, "phq9_q9": 2},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        assert "PHQ9_SELF_HARM" in types

    def test_pcl5_elevated_creates_high_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        # Score of 40: 20 items x 2
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {f"pcl5_q{i}": 2 for i in range(1, 21)},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        assert "PCL5_ELEVATED" in types

    def test_pha_expired_creates_medium_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"last_pha_date": "2024-01-01"},  # well past 12 months
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        severities = {f["type"]: f["severity"] for f in data["red_flags"]}
        assert "PHA_EXPIRED" in severities
        assert severities["PHA_EXPIRED"] == "MEDIUM"

    def test_immunization_gap_creates_medium_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"immunizations_current": False},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        severities = {f["type"]: f["severity"] for f in data["red_flags"]}
        assert "IMMUNIZATION_GAP" in severities
        assert severities["IMMUNIZATION_GAP"] == "MEDIUM"

    def test_pregnancy_creates_high_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"pregnancy": True},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        types = [f["type"] for f in data["red_flags"]]
        assert "PREGNANCY" in types

    def test_new_medication_creates_low_flag(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"new_medication": True},
        })
        assert r.status_code == 201
        data = r.get_json()
        cleanup_assessments.append(data["id"])
        severities = {f["type"]: f["severity"] for f in data["red_flags"]}
        assert "NEW_MEDICATION" in severities
        assert severities["NEW_MEDICATION"] == "LOW"

    def test_draft_status_skips_rule_engine(
        self, client, live_service_member_id, cleanup_assessments
    ):
        # DRAFT never calls the rule engine — no sm_state_restore needed.
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


# ---------------------------------------------------------------------------
# POST /api/assessments — deployability side-effect on service_members table
# ---------------------------------------------------------------------------

class TestDeployabilitySideEffect:
    def test_high_dental_sets_non_deployable_with_reason_dental(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 3},
        })
        assert r.status_code == 201
        cleanup_assessments.append(r.get_json()["id"])

        sm = db.query_one(
            "SELECT deployable, deployable_reason FROM service_members WHERE id = %s",
            (live_service_member_id,),
        )
        assert sm["deployable"] is False
        assert sm["deployable_reason"] == "Dental"

    def test_high_phq9_sets_non_deployable_with_reason_behavioral_health(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "POST",
            "status": "SUBMITTED",
            "responses": {**{f"phq9_q{i}": 2 for i in range(1, 9)}, "phq9_q9": 0},
        })
        assert r.status_code == 201
        cleanup_assessments.append(r.get_json()["id"])

        sm = db.query_one(
            "SELECT deployable, deployable_reason FROM service_members WHERE id = %s",
            (live_service_member_id,),
        )
        assert sm["deployable"] is False
        assert sm["deployable_reason"] == "Behavioral Health"

    def test_high_pregnancy_sets_non_deployable_with_reason_pregnancy(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"pregnancy": True},
        })
        assert r.status_code == 201
        cleanup_assessments.append(r.get_json()["id"])

        sm = db.query_one(
            "SELECT deployable, deployable_reason FROM service_members WHERE id = %s",
            (live_service_member_id,),
        )
        assert sm["deployable"] is False
        assert sm["deployable_reason"] == "Pregnancy"

    def test_clean_submission_sets_member_deployable(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        # Force non-deployable first so there's something to flip back.
        db.execute(
            "UPDATE service_members SET deployable = false, deployable_reason = 'Test' WHERE id = %s",
            (live_service_member_id,),
            returning=False,
        )

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
        cleanup_assessments.append(r.get_json()["id"])

        sm = db.query_one(
            "SELECT deployable, deployable_reason FROM service_members WHERE id = %s",
            (live_service_member_id,),
        )
        assert sm["deployable"] is True
        assert sm["deployable_reason"] is None


# ---------------------------------------------------------------------------
# PATCH /api/assessments/:id/certify
# ---------------------------------------------------------------------------

class TestCertifyLive:
    def test_certify_sets_status_certified(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 1},
        })
        assert r.status_code == 201
        a_id = r.get_json()["id"]
        cleanup_assessments.append(a_id)

        rc = client.patch(f"/api/assessments/{a_id}/certify", json={})
        assert rc.status_code == 200
        assert rc.get_json()["status"] == "CERTIFIED"

    def test_certify_sets_certified_at(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 1},
        })
        assert r.status_code == 201
        a_id = r.get_json()["id"]
        cleanup_assessments.append(a_id)

        rc = client.patch(f"/api/assessments/{a_id}/certify", json={})
        assert rc.status_code == 200
        assert rc.get_json()["certified_at"] is not None

    def test_certify_sets_member_deployable_when_no_other_high_flags(
        self, client, cleanup_assessments, sm_state_restore
    ):
        # Find a SM with no existing open HIGH flags for a clean certify test.
        rows = db.query("""
            SELECT sm.id FROM service_members sm
            WHERE NOT EXISTS (
                SELECT 1 FROM red_flags rf
                JOIN assessments a ON a.id = rf.assessment_id
                WHERE a.service_member_id = sm.id
                  AND rf.severity = 'HIGH'
                  AND rf.resolved_at IS NULL
            )
            LIMIT 1
        """)
        if not rows:
            pytest.skip("No service member with zero open HIGH flags available")
        sm_id = sm_state_restore(str(rows[0]["id"]))

        # Create a HIGH flag assessment so there's something to certify.
        r = client.post("/api/assessments", json={
            "service_member_id": sm_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 3},
        })
        assert r.status_code == 201
        a_id = r.get_json()["id"]
        cleanup_assessments.append(a_id)

        # Member is non-deployable after the HIGH flag.
        sm_before = db.query_one("SELECT deployable FROM service_members WHERE id = %s", (sm_id,))
        assert sm_before["deployable"] is False

        # Certify — no other open HIGH flags, so member becomes deployable.
        rc = client.patch(f"/api/assessments/{a_id}/certify", json={})
        assert rc.status_code == 200

        sm_after = db.query_one("SELECT deployable FROM service_members WHERE id = %s", (sm_id,))
        assert sm_after["deployable"] is True

    def test_certify_guard_keeps_member_non_deployable_when_other_high_flag_open(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)

        # Create two assessments each with a HIGH flag.
        r1 = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 3},
        })
        assert r1.status_code == 201
        a1_id = r1.get_json()["id"]
        cleanup_assessments.append(a1_id)

        r2 = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "POST",
            "status": "SUBMITTED",
            "responses": {"dental_class": 4},
        })
        assert r2.status_code == 201
        a2_id = r2.get_json()["id"]
        cleanup_assessments.append(a2_id)

        # Certify only assessment 1.
        rc = client.patch(f"/api/assessments/{a1_id}/certify", json={})
        assert rc.status_code == 200
        assert rc.get_json()["status"] == "CERTIFIED"

        # Assessment 2 still has an open HIGH flag → member must stay non-deployable.
        sm = db.query_one("SELECT deployable FROM service_members WHERE id = %s", (live_service_member_id,))
        assert sm["deployable"] is False


# ---------------------------------------------------------------------------
# PATCH /api/assessments/:id/refer
# ---------------------------------------------------------------------------

class TestReferLive:
    def test_refer_sets_status_referred(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 1},
        })
        assert r.status_code == 201
        a_id = r.get_json()["id"]
        cleanup_assessments.append(a_id)

        rr = client.patch(f"/api/assessments/{a_id}/refer",
                          json={"referral_type": "BEHAVIORAL_HEALTH"})
        assert rr.status_code == 200
        assert rr.get_json()["status"] == "REFERRED"

    def test_refer_sets_referral_type(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 1},
        })
        assert r.status_code == 201
        a_id = r.get_json()["id"]
        cleanup_assessments.append(a_id)

        rr = client.patch(f"/api/assessments/{a_id}/refer",
                          json={"referral_type": "DENTAL",
                                "referral_notes": "needs Class 2 clearance"})
        assert rr.status_code == 200
        data = rr.get_json()
        assert data["referral_type"] == "DENTAL"
        assert data["referral_notes"] == "needs Class 2 clearance"

    def test_refer_sets_member_non_deployable(
        self, client, live_service_member_id, cleanup_assessments, sm_state_restore
    ):
        sm_state_restore(live_service_member_id)
        # Force deployable=true so there's an observable change.
        db.execute(
            "UPDATE service_members SET deployable = true, deployable_reason = NULL WHERE id = %s",
            (live_service_member_id,),
            returning=False,
        )

        r = client.post("/api/assessments", json={
            "service_member_id": live_service_member_id,
            "type": "PRE",
            "status": "SUBMITTED",
            "responses": {"dental_class": 1},
        })
        assert r.status_code == 201
        a_id = r.get_json()["id"]
        cleanup_assessments.append(a_id)

        rr = client.patch(f"/api/assessments/{a_id}/refer",
                          json={"referral_type": "BEHAVIORAL_HEALTH"})
        assert rr.status_code == 200

        sm = db.query_one(
            "SELECT deployable, deployable_reason FROM service_members WHERE id = %s",
            (live_service_member_id,),
        )
        assert sm["deployable"] is False
        assert sm["deployable_reason"] == "BEHAVIORAL_HEALTH"


# ---------------------------------------------------------------------------
# GET /api/service-members
# ---------------------------------------------------------------------------

class TestServiceMembersLive:
    def test_list_returns_200_and_list(self, client):
        r = client.get("/api/service-members")
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)

    def test_list_has_expected_fields(self, client):
        data = client.get("/api/service-members").get_json()
        if not data:
            pytest.skip("No service members in DB")
        first = data[0]
        for field in ("id", "last_name", "first_name", "rank", "edipi", "unit_id", "deployable"):
            assert field in first, f"missing expected field '{field}'"

    def test_filter_by_unit_id(self, client, live_unit_id):
        r = client.get(f"/api/service-members?unit_id={live_unit_id}")
        assert r.status_code == 200
        data = r.get_json()
        if not data:
            pytest.skip("No service members in this unit")
        for row in data:
            assert row["unit_id"] == live_unit_id

    def test_filter_deployable_false(self, client):
        r = client.get("/api/service-members?deployable=false")
        assert r.status_code == 200
        for row in r.get_json():
            assert row["deployable"] is False

    def test_filter_deployable_true(self, client):
        r = client.get("/api/service-members?deployable=true")
        assert r.status_code == 200
        for row in r.get_json():
            assert row["deployable"] is True

    def test_detail_returns_member_with_assessments(self, client, live_service_member_id):
        r = client.get(f"/api/service-members/{live_service_member_id}")
        assert r.status_code == 200
        data = r.get_json()
        assert data["id"] == live_service_member_id
        assert "assessments" in data
        assert isinstance(data["assessments"], list)

    def test_unknown_member_returns_404(self, client):
        r = client.get("/api/service-members/00000000-0000-0000-0000-000000000000")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Seed acceptance — validate spec counts against live DB
# ---------------------------------------------------------------------------

class TestSeedAcceptance:
    """The spec states: running the engine against the seeded responses must
    reproduce 17 red_flags and 12 non-deployable soldiers (86.7% battalion
    readiness). These tests confirm those rows exist in the DB after seeding.
    """

    def test_at_least_12_non_deployable_soldiers(self, client):
        r = client.get("/api/service-members?deployable=false")
        assert r.status_code == 200
        count = len(r.get_json())
        assert count >= 12, (
            f"Spec requires 12 non-deployable soldiers from seed data; found {count}"
        )

    def test_at_least_17_red_flags_in_db(self):
        rows = db.query("SELECT COUNT(*) AS n FROM red_flags")
        count = rows[0]["n"]
        assert count >= 17, (
            f"Spec requires 17 seed red flags; found {count}"
        )