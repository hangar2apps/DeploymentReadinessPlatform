"""HTTP tests for unit routes and readiness_stats helper.

Covers:
  GET /api/units      — list all units
  GET /api/units/:id  — unit detail with readiness stats and children
  readiness_stats()   — pure unit tests of the stats helper (pct calculation, edge cases)

All DB calls are mocked — no live connection required.

Run:
    cd backend
    uv run pytest tests/test_units_routes.py -v
"""

from unittest.mock import patch
import pytest

from app import create_app
from blueprints.units import readiness_stats


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


_FAKE_UNIT = {
    "id": "00000000-0000-0000-0000-000000000010",
    "name": "1-1 IN BN",
    "short_name": "1-1 IN",
    "uic": "WJ1AA0",
    "parent_unit_id": None,
}

_FAKE_CHILD = {
    "id": "00000000-0000-0000-0000-000000000020",
    "name": "Alpha Company",
    "short_name": "A CO",
    "uic": "WJ1AA1",
    "parent_unit_id": "00000000-0000-0000-0000-000000000010",
}

_FAKE_READINESS = {
    "assigned": 90,
    "deployable": 78,
    "non_deployable": 12,
    "deployable_pct": 86.7,
}


# ---------------------------------------------------------------------------
# GET /api/units — list all units
# ---------------------------------------------------------------------------

class TestListUnits:
    def test_returns_200(self, client):
        with patch("blueprints.units.db.query", return_value=[]):
            r = client.get("/api/units")
        assert r.status_code == 200

    def test_returns_list_of_units(self, client):
        with patch("blueprints.units.db.query", return_value=[_FAKE_UNIT, _FAKE_CHILD]):
            r = client.get("/api/units")
        data = r.get_json()
        assert isinstance(data, list)
        assert len(data) == 2

    def test_returns_empty_list_when_no_units(self, client):
        with patch("blueprints.units.db.query", return_value=[]):
            r = client.get("/api/units")
        assert r.get_json() == []

    def test_response_includes_unit_fields(self, client):
        with patch("blueprints.units.db.query", return_value=[_FAKE_UNIT]):
            r = client.get("/api/units")
        unit = r.get_json()[0]
        assert unit["id"] == _FAKE_UNIT["id"]
        assert unit["name"] == _FAKE_UNIT["name"]


# ---------------------------------------------------------------------------
# GET /api/units/:id — unit detail
# ---------------------------------------------------------------------------

class TestGetUnit:
    def test_returns_404_for_unknown_unit(self, client):
        with patch("blueprints.units.db.query_one", return_value=None):
            r = client.get("/api/units/00000000-0000-0000-0000-000000000099")
        assert r.status_code == 404
        assert r.get_json()["error"] == "unit not found"

    def test_returns_200_for_known_unit(self, client):
        with patch("blueprints.units.db.query_one", return_value=dict(_FAKE_UNIT)), \
             patch("blueprints.units.db.query", return_value=[]), \
             patch("blueprints.units.readiness_stats", return_value=_FAKE_READINESS):
            r = client.get(f"/api/units/{_FAKE_UNIT['id']}")
        assert r.status_code == 200

    def test_response_includes_readiness_stats(self, client):
        with patch("blueprints.units.db.query_one", return_value=dict(_FAKE_UNIT)), \
             patch("blueprints.units.db.query", return_value=[]), \
             patch("blueprints.units.readiness_stats", return_value=_FAKE_READINESS):
            r = client.get(f"/api/units/{_FAKE_UNIT['id']}")
        assert r.get_json()["readiness"] == _FAKE_READINESS

    def test_response_includes_child_units(self, client):
        with patch("blueprints.units.db.query_one", return_value=dict(_FAKE_UNIT)), \
             patch("blueprints.units.db.query", return_value=[_FAKE_CHILD]), \
             patch("blueprints.units.readiness_stats", return_value=_FAKE_READINESS):
            r = client.get(f"/api/units/{_FAKE_UNIT['id']}")
        assert r.get_json()["children"] == [_FAKE_CHILD]

    def test_response_includes_unit_base_fields(self, client):
        with patch("blueprints.units.db.query_one", return_value=dict(_FAKE_UNIT)), \
             patch("blueprints.units.db.query", return_value=[]), \
             patch("blueprints.units.readiness_stats", return_value=_FAKE_READINESS):
            r = client.get(f"/api/units/{_FAKE_UNIT['id']}")
        data = r.get_json()
        assert data["id"] == _FAKE_UNIT["id"]
        assert data["name"] == _FAKE_UNIT["name"]

    def test_invalid_uuid_in_path_returns_404(self, client):
        r = client.get("/api/units/not-a-valid-uuid")
        assert r.status_code == 404

    def test_unit_with_no_children_returns_empty_children_list(self, client):
        with patch("blueprints.units.db.query_one", return_value=dict(_FAKE_UNIT)), \
             patch("blueprints.units.db.query", return_value=[]), \
             patch("blueprints.units.readiness_stats", return_value=_FAKE_READINESS):
            r = client.get(f"/api/units/{_FAKE_UNIT['id']}")
        assert r.get_json()["children"] == []


# ---------------------------------------------------------------------------
# readiness_stats() — unit tests for the stats helper
# ---------------------------------------------------------------------------

class TestReadinessStats:
    def test_zero_members_returns_zero_pct(self):
        row = {"assigned": 0, "deployable": 0, "non_deployable": 0}
        with patch("blueprints.units.db.query_one", return_value=row):
            stats = readiness_stats("unit-1")
        assert stats["deployable_pct"] == 0.0
        assert stats["assigned"] == 0

    def test_fully_deployable_unit_returns_100_pct(self):
        row = {"assigned": 20, "deployable": 20, "non_deployable": 0}
        with patch("blueprints.units.db.query_one", return_value=row):
            stats = readiness_stats("unit-1")
        assert stats["deployable_pct"] == 100.0

    def test_partial_deployability_rounds_to_one_decimal(self):
        row = {"assigned": 3, "deployable": 2, "non_deployable": 1}
        with patch("blueprints.units.db.query_one", return_value=row):
            stats = readiness_stats("unit-1")
        # 2/3 = 66.666... rounds to 66.7
        assert stats["deployable_pct"] == 66.7

    def test_returns_all_four_keys(self):
        row = {"assigned": 10, "deployable": 8, "non_deployable": 2}
        with patch("blueprints.units.db.query_one", return_value=row):
            stats = readiness_stats("unit-1")
        assert set(stats.keys()) == {"assigned", "deployable", "non_deployable", "deployable_pct"}

    def test_none_row_treated_as_zero_for_all_fields(self):
        with patch("blueprints.units.db.query_one", return_value=None):
            stats = readiness_stats("unit-1")
        assert stats["assigned"] == 0
        assert stats["deployable"] == 0
        assert stats["non_deployable"] == 0
        assert stats["deployable_pct"] == 0.0

    def test_null_db_values_treated_as_zero(self):
        row = {"assigned": None, "deployable": None, "non_deployable": None}
        with patch("blueprints.units.db.query_one", return_value=row):
            stats = readiness_stats("unit-1")
        assert stats["assigned"] == 0
        assert stats["deployable_pct"] == 0.0

    def test_non_deployable_count_is_correct(self):
        row = {"assigned": 100, "deployable": 85, "non_deployable": 15}
        with patch("blueprints.units.db.query_one", return_value=row):
            stats = readiness_stats("unit-1")
        assert stats["non_deployable"] == 15

    def test_deployable_pct_uses_assigned_as_denominator(self):
        row = {"assigned": 40, "deployable": 30, "non_deployable": 10}
        with patch("blueprints.units.db.query_one", return_value=row):
            stats = readiness_stats("unit-1")
        # 30/40 = 75.0
        assert stats["deployable_pct"] == 75.0