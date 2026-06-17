"""
Service member routes — list and detail.
"""

from typing import Tuple
from uuid import UUID
from flask import Blueprint, request, jsonify
from flask.wrappers import Response

import db

bp = Blueprint("service_members", __name__, url_prefix="/api/service-members")

_BASE_SELECT = """
  SELECT sm.*, u.name AS unit_name, u.short_name AS unit_short_name
  FROM service_members sm
  JOIN units u ON u.id = sm.unit_id
"""


@bp.get("")
def list_members() -> Response:
    """
    GET /api/service-members — filterable by unit and deployable status.
    """

    clauses, params = [], []
    if unit_id := request.args.get("unit_id"):
        clauses.append("sm.unit_id = %s")
        params.append(unit_id)
    # deployable=false / true filter (string from the query param).
    if (deployable := request.args.get("deployable")) is not None:
        clauses.append("sm.deployable = %s")
        params.append(deployable.lower() in ("true", "1", "yes"))

    sql = _BASE_SELECT
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY sm.last_name, sm.first_name"
    return jsonify(db.query(sql, params))


@bp.get("/<uuid:member_id>")
def get_member(member_id: UUID) -> Tuple[Response, int]:
    """
    GET /api/service-members/:id — detail with their assessments.
    """

    row = db.query_one(_BASE_SELECT + " WHERE sm.id = %s", (str(member_id),))
    if not row:
        return jsonify({"error": "service member not found"}), 404
    row["assessments"] = db.query(
        "SELECT * FROM assessments WHERE service_member_id = %s ORDER BY created_at DESC",
        (str(member_id),),
    )
    return jsonify(row), 200
