"""HTTP tests for the notification (email-trigger) routes.

Covers both the email behavior and the auth guards added so these provider/
commander-only endpoints match the rest of the API:

  POST /api/units/:id/notify-deployment      — pre-deployment blast
  POST /api/assessments/:id/notify-referral  — manual referral email

All DB and email-service calls are mocked — no live connection or SendGrid key required. Identity is supplied via the dev-header fallback (see backend/auth.py).

Run:
    cd backend
    uv run pytest tests/test_notifications.py -v
"""

from datetime import date, datetime, timezone
from unittest.mock import patch

import pytest

from app import create_app

# The caller's command unit. Matching the path unit_id lets scope_unit pass
# without a DB lookup (own == requested short-circuits the subtree check).
UNIT_ID = "00000000-0000-0000-0000-000000000010"
OTHER_UNIT_ID = "11111111-1111-1111-1111-111111111111"
ASSESSMENT_ID = "00000000-0000-0000-0000-0000000000a1"


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        # Notification routes are provider/commander-guarded; authenticate as a
        # commander scoped to UNIT_ID via the dev-header fallback.
        c.environ_base["HTTP_X_DEV_ROLE"] = "commander"
        c.environ_base["HTTP_X_DEV_UNIT_ID"] = UNIT_ID
        yield c


_FAKE_UNIT = {
    "id": UNIT_ID,
    "name": "1-1 IN BN",
    "deployment_date": date(2026, 9, 1),
}

_FAKE_MEMBER = {
    "id": "00000000-0000-0000-0000-0000000000b1",
    "email": "soldier@example.mil",
    "unit_name": "1-1 IN BN",
}


# ---------------------------------------------------------------------------
# POST /api/units/:id/notify-deployment
# ---------------------------------------------------------------------------


class TestNotifyDeployment:
    def test_no_auth_is_401(self):
        app = create_app()
        app.config["TESTING"] = True
        with app.test_client() as c:  # no dev headers -> anonymous
            r = c.post(f"/api/units/{UNIT_ID}/notify-deployment")
        assert r.status_code == 401

    def test_service_member_role_is_403(self, client):
        client.environ_base["HTTP_X_DEV_ROLE"] = "service_member"
        r = client.post(f"/api/units/{UNIT_ID}/notify-deployment")
        assert r.status_code == 403

    def test_unit_outside_command_is_403(self, client):
        # Requesting a unit not in the caller's subtree -> scope_unit raises 403
        # before any unit lookup happens.
        with patch("auth.db.query_one", return_value=None):  # not in subtree
            r = client.post(f"/api/units/{OTHER_UNIT_ID}/notify-deployment")
        assert r.status_code == 403
        assert "outside your command" in r.get_json()["error"]

    def test_unknown_unit_is_404(self, client):
        with patch("blueprints.notifications.db.query_one", return_value=None):
            r = client.post(f"/api/units/{UNIT_ID}/notify-deployment")
        assert r.status_code == 404

    def test_missing_deployment_date_is_422(self, client):
        unit = {**_FAKE_UNIT, "deployment_date": None}
        with patch("blueprints.notifications.db.query_one", return_value=unit):
            r = client.post(f"/api/units/{UNIT_ID}/notify-deployment")
        assert r.status_code == 422

    def test_sends_to_members_with_email_and_skips_without(self, client):
        members = [_FAKE_MEMBER, {"id": "x", "email": None}]
        with (
            patch(
                "blueprints.notifications.db.query_one", return_value=dict(_FAKE_UNIT)
            ),
            patch("blueprints.notifications.get_subtree_members", return_value=members),
            patch("blueprints.notifications.latest_incomplete_items", return_value=[]),
            patch(
                "blueprints.notifications.email_service.send_deployment_blast"
            ) as send,
        ):
            r = client.post(f"/api/units/{UNIT_ID}/notify-deployment")
        assert r.status_code == 200
        assert r.get_json() == {"sent": 1, "skipped": 1}
        assert send.call_count == 1


# ---------------------------------------------------------------------------
# POST /api/assessments/:id/notify-referral
# ---------------------------------------------------------------------------


class TestNotifyReferral:
    def test_no_auth_is_401(self):
        app = create_app()
        app.config["TESTING"] = True
        with app.test_client() as c:  # no dev headers -> anonymous
            r = c.post(f"/api/assessments/{ASSESSMENT_ID}/notify-referral")
        assert r.status_code == 401

    def test_service_member_role_is_403(self, client):
        client.environ_base["HTTP_X_DEV_ROLE"] = "service_member"
        r = client.post(f"/api/assessments/{ASSESSMENT_ID}/notify-referral")
        assert r.status_code == 403

    def test_unknown_assessment_is_404(self, client):
        with patch("blueprints.notifications.db.query_one", return_value=None):
            r = client.post(f"/api/assessments/{ASSESSMENT_ID}/notify-referral")
        assert r.status_code == 404

    def test_wrong_status_is_422(self, client):
        assessment = {"id": ASSESSMENT_ID, "status": "DRAFT"}
        with patch("blueprints.notifications.db.query_one", return_value=assessment):
            r = client.post(f"/api/assessments/{ASSESSMENT_ID}/notify-referral")
        assert r.status_code == 422

    def test_already_notified_is_409(self, client):
        assessment = {
            "id": ASSESSMENT_ID,
            "status": "REFERRED",
            "referral_notified_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        }
        with patch("blueprints.notifications.db.query_one", return_value=assessment):
            r = client.post(f"/api/assessments/{ASSESSMENT_ID}/notify-referral")
        assert r.status_code == 409

    def test_successful_send_records_timestamp_and_returns_200(self, client):
        assessment = {
            "id": ASSESSMENT_ID,
            "status": "SUBMITTED",
            "service_member_id": _FAKE_MEMBER["id"],
            "referral_notified_at": None,
        }
        # First query_one returns the assessment, second returns the member.
        with (
            patch(
                "blueprints.notifications.db.query_one",
                side_effect=[assessment, dict(_FAKE_MEMBER)],
            ),
            patch(
                "blueprints.notifications.email_service.send_referral_notification",
                return_value=True,
            ),
            patch("blueprints.notifications.db.execute") as execute,
        ):
            r = client.post(f"/api/assessments/{ASSESSMENT_ID}/notify-referral")
        assert r.status_code == 200
        assert r.get_json() == {"sent": True, "to": _FAKE_MEMBER["email"]}
        assert execute.call_count == 1  # timestamp recorded

    def test_delivery_failure_is_502_and_does_not_record(self, client):
        assessment = {
            "id": ASSESSMENT_ID,
            "status": "SUBMITTED",
            "service_member_id": _FAKE_MEMBER["id"],
            "referral_notified_at": None,
        }
        with (
            patch(
                "blueprints.notifications.db.query_one",
                side_effect=[assessment, dict(_FAKE_MEMBER)],
            ),
            patch(
                "blueprints.notifications.email_service.send_referral_notification",
                return_value=False,
            ),
            patch("blueprints.notifications.db.execute") as execute,
        ):
            r = client.post(f"/api/assessments/{ASSESSMENT_ID}/notify-referral")
        assert r.status_code == 502
        assert execute.call_count == 0  # no timestamp on failure -> retry allowed
