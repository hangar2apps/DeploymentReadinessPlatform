"""HTTP tests for readiness routes and related assessment behaviors.

These tests mock the DB layer so they verify route behavior and response shapes
without requiring a live Supabase connection.
"""

import contextlib
from datetime import date as real_date
from decimal import Decimal
from unittest.mock import patch

import pytest

from app import create_app


def _recording_transaction(calls, assessment_row, remaining_row=None):
    """db.transaction() stand-in for certify/refer tests.

    Records each (sql, params) into `calls`, returns `assessment_row` for the
    assessment UPDATE...RETURNING and `remaining_row` for the remaining-HIGH-flag
    SELECT (certify only).
    """

    class _Cur:
        def __init__(self):
            self._sql = ""

        def execute(self, sql, params=None):
            calls.append((sql, params))
            self._sql = sql

        def fetchone(self):
            if "UPDATE assessments" in self._sql:
                return assessment_row
            if "red_flags rf" in self._sql:
                return remaining_row
            return None

    @contextlib.contextmanager
    def _cm():
        yield _Cur()

    return _cm


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        # Readiness routes are commander-only and certify/refer are provider/commander;
        # the assessment-behavior tests below patch the role per class. Default the
        # client to a commander with no home unit (so unit scoping is permissive and
        # the strict DB mocks aren't perturbed — see auth.scope_unit).
        test_client.environ_base["HTTP_X_DEV_ROLE"] = "commander"
        yield test_client


class FixedDate(real_date):
    """Stable date helper so the synthetic trend output is deterministic."""

    @classmethod
    def today(cls):
        return cls(2026, 6, 17)


class TestReadinessEndpoint:
    def test_returns_flat_contract_shape(self, client):
        def query_one_side_effect(sql, params=None):
            if "parent_unit_id IS NULL" in sql:
                return {"id": "bn-1"}
            if "AS compliant" in sql:
                return {"total": 90, "compliant": 0}
            if "SELECT id FROM units WHERE id = %s" in sql:
                assert params is not None
                return {"id": params[0]}
            raise AssertionError(f"Unexpected query_one SQL: {sql}")

        def query_side_effect(sql, params=None):
            if "SELECT id, short_name FROM units WHERE parent_unit_id = %s" in sql:
                return [
                    {"id": "co-a", "short_name": "A CO"},
                    {"id": "co-b", "short_name": "B CO"},
                ]
            raise AssertionError(f"Unexpected query SQL: {sql}")

        def readiness_stats_side_effect(unit_id):
            stats = {
                "bn-1": {
                    "assigned": 90,
                    "deployable": 78,
                    "non_deployable": 12,
                    "deployable_pct": 86.7,
                },
                "co-a": {
                    "assigned": 19,
                    "deployable": 17,
                    "non_deployable": 2,
                    "deployable_pct": 89.5,
                },
                "co-b": {
                    "assigned": 19,
                    "deployable": 13,
                    "non_deployable": 6,
                    "deployable_pct": 68.4,
                },
            }
            return stats[unit_id]

        with patch("blueprints.readiness.db.query_one", side_effect=query_one_side_effect), patch(
            "blueprints.readiness.db.query", side_effect=query_side_effect
        ), patch(
            "blueprints.readiness.readiness_stats",
            side_effect=readiness_stats_side_effect,
        ):
            response = client.get("/api/readiness")

        assert response.status_code == 200
        data = response.get_json()
        assert data == {
            "unit_id": "bn-1",
            "total_assigned": 90,
            "deployable_count": 78,
            "non_deployable_count": 12,
            "pct_deployable": 86.7,
            "delta_from_last_week": -4.3,
            "pdhra_compliance_pct": 0.0,
            "by_company": [
                {
                    "unit_id": "co-a",
                    "short_name": "A CO",
                    "assigned": 19,
                    "deployable": 17,
                    "pct": 89.5,
                },
                {
                    "unit_id": "co-b",
                    "short_name": "B CO",
                    "assigned": 19,
                    "deployable": 13,
                    "pct": 68.4,
                },
            ],
        }

    def test_returns_404_for_unknown_unit(self, client):
        with patch("blueprints.readiness._unit_exists", return_value=False):
            response = client.get("/api/readiness?unit_id=missing")

        assert response.status_code == 404
        assert response.get_json() == {"error": "unit not found"}


class TestReadinessTrendEndpoint:
    def test_returns_expected_points_and_keys(self, client):
        with patch("blueprints.readiness._unit_exists", return_value=True), patch(
            "blueprints.readiness.readiness_stats",
            return_value={"deployable_pct": 86.7},
        ), patch("blueprints.readiness.date", FixedDate):
            response = client.get("/api/readiness/trend?unit_id=bn-1&days=2")

        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 3
        assert data[0] == {"date": "2026-06-15", "pct_deployable": 80.7}
        assert data[-1] == {"date": "2026-06-17", "pct_deployable": 86.7}

    def test_returns_404_for_missing_unit(self, client):
        with patch("blueprints.readiness._unit_exists", return_value=False):
            response = client.get("/api/readiness/trend?unit_id=bad-unit&days=90")

        assert response.status_code == 404
        assert response.get_json() == {"error": "unit not found"}


class TestPostDeploymentReadinessEndpoint:
    def test_converts_decimals_and_fills_missing_keys(self, client):
        # Mirror what psycopg actually returns: ROUND(...::numeric, 1) yields a
        # Decimal, and a key may be absent. The route must coerce to float and
        # fall back to defaults, so feed values that differ from the response.
        row = {
            "total_returned": 8,
            "post_dha_complete": 3,
            # post_dha_pending intentionally omitted -> exercises .get default
            "flagged_behavioral_health": 3,
            "flagged_tbi_screening": 4,
            "avg_phq9_delta": Decimal("3.0"),
            "avg_pcl5_delta": Decimal("17.0"),
        }

        with patch("blueprints.readiness._unit_exists", return_value=True), patch(
            "blueprints.readiness.db.query_one",
            return_value=row,
        ):
            response = client.get("/api/readiness/post-deployment?unit_id=bn-1")

        assert response.status_code == 200
        data = response.get_json()
        assert data == {
            "total_returned": 8,
            "post_dha_complete": 3,
            "post_dha_pending": 0,
            "flagged_behavioral_health": 3,
            "flagged_tbi_screening": 4,
            "avg_phq9_delta": 3.0,
            "avg_pcl5_delta": 17.0,
        }
        # JSON has no Decimal type, so a leaked Decimal would serialize the same;
        # assert the Python types to prove float() actually ran.
        assert isinstance(data["avg_phq9_delta"], float)
        assert isinstance(data["avg_pcl5_delta"], float)

    def test_defaults_when_no_unit_arg_and_empty_metrics(self, client):
        # No unit_id -> _default_unit_id() runs; empty metrics row -> the `or {}`
        # path and every `.get(..., default) or default` fallback fire.
        def query_one_side_effect(sql, params=None):
            if "parent_unit_id IS NULL" in sql:
                return {"id": "bn-default"}
            if "SELECT id FROM units WHERE id = %s" in sql:
                return {"id": params[0]}
            if "latest_post" in sql:
                return None
            raise AssertionError(f"Unexpected query_one SQL: {sql}")

        with patch(
            "blueprints.readiness.db.query_one", side_effect=query_one_side_effect
        ):
            response = client.get("/api/readiness/post-deployment")

        assert response.status_code == 200
        assert response.get_json() == {
            "total_returned": 0,
            "post_dha_complete": 0,
            "post_dha_pending": 0,
            "flagged_behavioral_health": 0,
            "flagged_tbi_screening": 0,
            "avg_phq9_delta": 0.0,
            "avg_pcl5_delta": 0.0,
        }

    def test_returns_404_for_unknown_unit(self, client):
        with patch("blueprints.readiness._unit_exists", return_value=False):
            response = client.get("/api/readiness/post-deployment?unit_id=bad-unit")

        assert response.status_code == 404
        assert response.get_json() == {"error": "unit not found"}


class TestRedFlagsSummaryEndpoint:
    def test_returns_array_response(self, client):
        rows = [
            {
                "category": "Dental",
                "severity": "HIGH",
                "soldier_count": 3,
                "units": ["B CO", "D CO"],
            },
            {
                "category": "Behavioral Health",
                "severity": "HIGH",
                "soldier_count": 2,
                "units": ["B CO"],
            },
        ]

        with patch("blueprints.readiness._unit_exists", return_value=True), patch(
            "blueprints.readiness.db.query", return_value=rows
        ):
            response = client.get("/api/red-flags/summary?unit_id=bn-1")

        assert response.status_code == 200
        assert response.get_json() == rows


class TestAssessmentBehaviorChanges:
    def test_certify_keeps_member_non_deployable_if_other_high_flags_remain(self, client):
        assessment_row = {
            "id": "assessment-1",
            "service_member_id": "member-1",
            "status": "CERTIFIED",
        }
        calls = []

        with patch(
            "blueprints.assessments.db.transaction",
            _recording_transaction(calls, assessment_row, {"type": "DENTAL_CLASS_3"}),
        ):
            response = client.patch(
                "/api/assessments/00000000-0000-0000-0000-000000000001/certify",
                json={"certified_by": "provider-1"},
            )

        assert response.status_code == 200
        service_member_update = next(
            call for call in calls if "UPDATE service_members SET deployable" in call[0]
        )
        assert service_member_update[1] == (False, "Dental", "member-1")

    def test_certify_restores_deployability_when_no_high_flags_remain(self, client):
        assessment_row = {
            "id": "assessment-1",
            "service_member_id": "member-1",
            "status": "CERTIFIED",
        }
        calls = []

        with patch(
            "blueprints.assessments.db.transaction",
            _recording_transaction(calls, assessment_row, None),
        ):
            response = client.patch(
                "/api/assessments/00000000-0000-0000-0000-000000000001/certify",
                json={"certified_by": "provider-1"},
            )

        assert response.status_code == 200
        service_member_update = next(
            call for call in calls if "UPDATE service_members SET deployable" in call[0]
        )
        assert service_member_update[1] == (True, None, "member-1")

    @pytest.mark.parametrize(
        ("referral_type", "expected_reason"),
        [
            ("BEHAVIORAL_HEALTH", "Behavioral Health"),
            ("DENTAL", "Dental"),
            ("PREGNANCY", "Pregnancy"),
            ("VISION_CARE", "Vision Care"),
        ],
    )
    def test_refer_normalizes_deployable_reason(self, client, referral_type, expected_reason):
        assessment_row = {
            "id": "assessment-1",
            "service_member_id": "member-1",
            "status": "REFERRED",
            "referral_type": referral_type,
        }
        calls = []

        with patch(
            "blueprints.assessments.db.transaction",
            _recording_transaction(calls, assessment_row),
        ):
            response = client.patch(
                "/api/assessments/00000000-0000-0000-0000-000000000001/refer",
                json={"referral_type": referral_type, "referral_notes": "note"},
            )

        assert response.status_code == 200
        service_member_update = next(
            call for call in calls if "UPDATE service_members SET deployable" in call[0]
        )
        assert service_member_update[1] == (expected_reason, "member-1")
