"""
Service member routes — list and detail.
"""

from typing import Tuple
from uuid import UUID
from flask import Blueprint, request, jsonify
from flask.wrappers import Response

import auth
import db

bp = Blueprint("service_members", __name__, url_prefix="/api/service-members")

_BASE_SELECT = """
  SELECT sm.*, u.name AS unit_name, u.short_name AS unit_short_name
  FROM service_members sm
  JOIN units u ON u.id = sm.unit_id
"""

# Subtree of a unit (the unit + descendants), for scoping list results.
_SUBTREE_IDS = """
  WITH RECURSIVE subtree AS (
    SELECT id FROM units WHERE id = %s
    UNION ALL
    SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
  )
  SELECT id FROM subtree
"""


@bp.get("")
@auth.require_role(auth.ROLE_PROVIDER, auth.ROLE_COMMANDER)
def list_members() -> Response:
    """
    GET /api/service-members — filterable by unit and deployable status.

    Scoped to the caller's own unit subtree (their command).
    """

    clauses, params = [], []
    if scope := auth.scope_unit(request.args.get("unit_id")):
        clauses.append(f"sm.unit_id IN ({_SUBTREE_IDS})")
        params.append(scope)
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

    Providers and commanders may read any member; a soldier may read only their
    own record (this backs the soldier landing screen's "my assessment" lookup).
    """

    ident = auth.current_identity()
    if not ident.subject_present:
        return jsonify({"error": "authentication required"}), 401
    # Providers/commanders may read any member; everyone else only their own row.
    privileged = {auth.ROLE_PROVIDER, auth.ROLE_COMMANDER}
    if not (ident.roles & privileged):
        if denied := auth.require_self(str(member_id)):
            return denied

    row = db.query_one(_BASE_SELECT + " WHERE sm.id = %s", (str(member_id),))
    if not row:
        return jsonify({"error": "service member not found"}), 404
    row["assessments"] = db.query(
        "SELECT * FROM assessments WHERE service_member_id = %s ORDER BY created_at DESC",
        (str(member_id),),
    )
    return jsonify(row), 200
