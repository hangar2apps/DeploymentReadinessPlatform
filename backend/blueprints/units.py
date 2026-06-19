"""
Unit routes — hierarchy list and detail with readiness stats.
"""

from typing import Any, Tuple
from uuid import UUID
from flask import Blueprint, jsonify
from flask.wrappers import Response

import auth
import db

bp = Blueprint("units", __name__, url_prefix="/api/units")


# Readiness for a unit counts every member in the unit AND its descendants
# (a battalion rolls up its companies). The recursive CTE walks the self-ref.
_READINESS_SQL = """
  WITH RECURSIVE subtree AS (
    SELECT id FROM units WHERE id = %s
    UNION ALL
    SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
  )
  SELECT
    COUNT(*)                                        AS assigned,
    COUNT(*) FILTER (WHERE sm.deployable)           AS deployable,
    COUNT(*) FILTER (WHERE NOT sm.deployable)       AS non_deployable
  FROM service_members sm
  WHERE sm.unit_id IN (SELECT id FROM subtree)
"""


def readiness_stats(unit_id: str) -> dict[str, Any]:
    """
    Return {assigned, deployable, non_deployable, deployable_pct} for a unit subtree.
    """

    row = db.query_one(_READINESS_SQL, (unit_id,)) or {}
    assigned = row.get("assigned", 0) or 0
    deployable = row.get("deployable", 0) or 0
    pct = round(100.0 * deployable / assigned, 1) if assigned else 0.0
    return {
        "assigned": assigned,
        "deployable": deployable,
        "non_deployable": row.get("non_deployable", 0) or 0,
        "deployable_pct": pct,
    }


@bp.get("")
@auth.require_role(auth.ROLE_PROVIDER, auth.ROLE_COMMANDER)
def list_units() -> Response:
    """
    GET /api/units — full list (parent_unit_id lets the client build the tree).
    """

    rows = db.query("SELECT * FROM units ORDER BY name")
    return jsonify(rows)


@bp.get("/<uuid:unit_id>")
@auth.require_role(auth.ROLE_PROVIDER, auth.ROLE_COMMANDER)
def get_unit(unit_id: UUID) -> Tuple[Response, int]:
    """
    GET /api/units/:id — detail with readiness stats and child units.
    """

    # Only within the caller's command (raises 403 otherwise).
    auth.scope_unit(str(unit_id))
    row = db.query_one("SELECT * FROM units WHERE id = %s", (str(unit_id),))
    if not row:
        return jsonify({"error": "unit not found"}), 404
    row["readiness"] = readiness_stats(str(unit_id))
    row["children"] = db.query(
        "SELECT * FROM units WHERE parent_unit_id = %s ORDER BY name", (str(unit_id),)
    )
    return jsonify(row), 200
