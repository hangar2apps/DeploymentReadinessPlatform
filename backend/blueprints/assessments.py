"""
Assessment routes — list, detail, create, certify, refer.

Submitting an assessment scores it and runs the red-flag rule engine (see rules.py), then updates the service member's deployable status.
"""

import json
from typing import Any, Tuple
from uuid import UUID
from flask import Blueprint, request, jsonify
from flask.wrappers import Response
from psycopg2.extras import RealDictRow


import db
import email_service
import rules

bp = Blueprint("assessments", __name__, url_prefix="/api/assessments")


def _notify_member(service_member_id: str, assessment: dict, kind: str) -> Tuple[bool, Any]:
    """
    Email the member about a certify/refer decision. Best-effort: returns
    (sent, email) and never raises, so a delivery failure can't undo the
    provider's decision (already committed by the caller). `kind` is
    'certify' or 'refer'.
    """
    try:
        member = db.query_one(
            "SELECT sm.*, u.name AS unit_name "
            "FROM service_members sm JOIN units u ON u.id = sm.unit_id "
            "WHERE sm.id = %s",
            (service_member_id,),
        )
        if not member or not member.get("email"):
            return False, None
        if kind == "certify":
            sent = email_service.send_certification_notification(member=member, assessment=assessment)
        else:
            sent = email_service.send_referral_notification(member=member, assessment=assessment)
        return bool(sent), member["email"]
    except Exception:
        return False, None


_BASE_SELECT = """
  SELECT a.*,
         sm.edipi, sm.rank, sm.last_name, sm.first_name, sm.middle_initial,
         sm.mos, sm.deployable AS sm_deployable, sm.deployable_reason AS sm_deployable_reason,
         sm.unit_id,
         u.name AS unit_name, u.short_name AS unit_short_name,
         u.uic AS unit_uic, u.parent_unit_id AS unit_parent_id
  FROM assessments a
  JOIN service_members sm ON sm.id = a.service_member_id
  JOIN units u            ON u.id = sm.unit_id
"""


def _shape(row: dict) -> dict:
    """Reshape a JOIN row into the nested member/unit/flags contract the frontend expects."""
    row = dict(row)
    member_unit_id = row["unit_id"]
    row["member"] = {
        "id":                row["service_member_id"],
        "rank":              row.pop("rank"),
        "last_name":         row.pop("last_name"),
        "first_name":        row.pop("first_name"),
        "edipi":             row.pop("edipi"),
        "middle_initial":    row.pop("middle_initial", None),
        "mos":               row.pop("mos", None),
        "unit_id":           member_unit_id,
        "deployable":        row.pop("sm_deployable", None),
        "deployable_reason": row.pop("sm_deployable_reason", None),
    }
    row["unit"] = {
        "id":             row.pop("unit_id"),
        "short_name":     row.pop("unit_short_name"),
        "name":           row.pop("unit_name", None),
        "uic":            row.pop("unit_uic", None),
        "parent_unit_id": row.pop("unit_parent_id", None),
    }
    row["flags"] = row.pop("red_flags", [])
    return row


def _flags_for(assessment_id: str) -> list[RealDictRow]:
    return db.query(
        "SELECT * FROM red_flags WHERE assessment_id = %s ORDER BY "
        "CASE severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END",
        (assessment_id,),
    )


def _reason_from_referral_type(referral_type):
    """Normalize referral categories to the commander-dashboard display values."""
    mapping = {
        "BEHAVIORAL_HEALTH": "Behavioral Health",
        "DENTAL": "Dental",
        "PREGNANCY": "Pregnancy",
    }
    if referral_type in mapping:
        return mapping[referral_type]
    return str(referral_type).replace("_", " ").title()


def _remaining_high_flag_reason(cur, service_member_id):
    """
    Return the category for any remaining unresolved HIGH flag, else None.

    Runs on the caller's transaction cursor so it sees flags resolved earlier in
    the same transaction (otherwise it would read pre-resolve state).
    """
    cur.execute(
        """
        SELECT rf.type
        FROM red_flags rf
        JOIN assessments a ON a.id = rf.assessment_id
        WHERE a.service_member_id = %s
          AND rf.resolved_at IS NULL
          AND rf.severity = 'HIGH'
        ORDER BY rf.created_at ASC
        LIMIT 1
        """,
        (service_member_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return rules._REASON_BY_TYPE.get(row["type"], "Medical")


@bp.get("")
def list_assessments() -> Response:
    """
    GET /api/assessments — filterable by status, unit, type.
    """

    clauses, params = [], []
    if status := request.args.get("status"):
        clauses.append("a.status = %s")
        params.append(status)
    if unit_id := request.args.get("unit_id"):
        clauses.append("sm.unit_id = %s")
        params.append(unit_id)
    if type_ := request.args.get("type"):
        clauses.append("a.type = %s")
        params.append(type_)

    sql = _BASE_SELECT
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    # Red-flagged first, then most recently submitted (per provider-queue spec).
    sql += """
      ORDER BY
        (SELECT COUNT(*) FROM red_flags rf
           WHERE rf.assessment_id = a.id AND rf.severity = 'HIGH') DESC,
        a.submitted_at DESC NULLS LAST,
        a.created_at DESC
    """
    rows = db.query(sql, params)
    for r in rows:
        r["red_flags"] = _flags_for(r["id"])
    return jsonify([_shape(r) for r in rows])


@bp.get("/<uuid:assessment_id>")
def get_assessment(assessment_id: UUID) -> Tuple[Response, int]:
    """
    GET /api/assessments/:id — full detail with red flags.
    """

    row = db.query_one(_BASE_SELECT + " WHERE a.id = %s", (str(assessment_id),))
    if not row:
        return jsonify({"error": "assessment not found"}), 404
    row["red_flags"] = _flags_for(str(assessment_id))
    return jsonify(_shape(dict(row))), 200


@bp.post("")
def create_assessment() -> Tuple[Response, int]:
    """
    POST /api/assessments — service member submits.

    Body: { service_member_id, type, responses, status? }
    If status is SUBMITTED (the default for a submit), we score it, run the rule engine, persist red flags, and update deployability.
    """

    body = request.get_json(silent=True) or {}
    service_member_id = body.get("service_member_id")
    type_ = body.get("type")
    responses = body.get("responses") or {}
    status = body.get("status", "SUBMITTED")

    if not service_member_id or type_ not in ("PRE", "POST", "PDHRA"):
        return jsonify({
            "error": "service_member_id and a valid type are required"
        }), 400

    phq9, pcl5 = rules.score(responses)
    submitting = status == "SUBMITTED"

    # Insert the assessment, run the rule engine, and update deployability inside
    # ONE transaction so a partial failure can't leave a soldier with cleared
    # flags but a stale deployable status (a silent false-clear).
    try:
        with db.transaction() as cur:
            cur.execute(
                """
                INSERT INTO assessments
                  (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
                VALUES (%s, %s, %s, %s, %s, %s, CASE WHEN %s THEN now() ELSE NULL END)
                RETURNING *
                """,
                (
                    service_member_id,
                    type_,
                    status,
                    json.dumps(responses),
                    phq9,
                    pcl5,
                    submitting,
                ),
            )
            assessment = cur.fetchone()
            flags = (
                _run_rule_engine(cur, assessment["id"], service_member_id, type_, responses, phq9, pcl5)
                if submitting
                else []
            )
    except Exception:
        return jsonify({"error": "failed to create assessment"}), 500

    assessment["red_flags"] = flags
    return jsonify(assessment), 201


@bp.patch("/<uuid:assessment_id>/certify")
def certify(assessment_id: UUID) -> Tuple[Response, int]:
    """
    PATCH /api/assessments/:id/certify — provider marks deployable.

    Body: { certified_by?: service_member_id }
    """

    body = request.get_json(silent=True) or {}

    # Block certification while any HIGH flag on this assessment is unresolved.
    high_flags = db.query(
        "SELECT id FROM red_flags WHERE assessment_id = %s AND resolved_at IS NULL AND severity = 'HIGH'",
        (str(assessment_id),),
    )
    if high_flags:
        return jsonify({"error": "Cannot certify: assessment has unresolved HIGH red flags"}), 409

    # Status update, flag resolution, and the deployability recompute run in one
    # transaction so a partial failure can't leave the member's status and flags
    # inconsistent.
    row = None
    try:
        with db.transaction() as cur:
            cur.execute(
                """
                UPDATE assessments
                SET status = 'CERTIFIED', certified_at = now(), certified_by = %s
                WHERE id = %s
                RETURNING *
                """,
                (body.get("certified_by"), str(assessment_id)),
            )
            row = cur.fetchone()
            if row:
                # Certification resolves this assessment's flags, but the member
                # only becomes deployable again if no other unresolved HIGH flag
                # remains.
                cur.execute(
                    "UPDATE red_flags SET resolved_at = now() "
                    "WHERE assessment_id = %s AND resolved_at IS NULL",
                    (str(assessment_id),),
                )
                remaining_reason = _remaining_high_flag_reason(cur, row["service_member_id"])
                cur.execute(
                    "UPDATE service_members SET deployable = %s, deployable_reason = %s "
                    "WHERE id = %s",
                    (remaining_reason is None, remaining_reason, row["service_member_id"]),
                )
    except Exception:
        return jsonify({"error": "failed to certify assessment"}), 500

    if not row:
        return jsonify({"error": "assessment not found"}), 404

    # Best-effort email — the certification is already committed regardless.
    sent, email = _notify_member(row["service_member_id"], row, "certify")
    return jsonify({**row, "notified": sent, "notified_to": email if sent else None}), 200


@bp.patch("/<uuid:assessment_id>/refer")
def refer(assessment_id: UUID) -> Tuple[Response, int]:
    """
    PATCH /api/assessments/:id/refer — provider refers out.

    Body: { referral_type, referral_notes? }
    Referral makes the member non-deployable pending the referral category.
    """

    body = request.get_json(silent=True) or {}
    referral_type = body.get("referral_type")
    if not referral_type:
        return jsonify({"error": "referral_type is required"}), 400

    # Assessment status + member deployability update together in one transaction.
    row = None
    try:
        with db.transaction() as cur:
            cur.execute(
                """
                UPDATE assessments
                SET status = 'REFERRED', referral_type = %s, referral_notes = %s
                WHERE id = %s
                RETURNING *
                """,
                (referral_type, body.get("referral_notes"), str(assessment_id)),
            )
            row = cur.fetchone()
            if row:
                cur.execute(
                    "UPDATE service_members SET deployable = false, deployable_reason = %s "
                    "WHERE id = %s",
                    (_reason_from_referral_type(referral_type), row["service_member_id"]),
                )
    except Exception:
        return jsonify({"error": "failed to refer assessment"}), 500

    if not row:
        return jsonify({"error": "assessment not found"}), 404

    # Best-effort email — the referral is already committed regardless.
    sent, email = _notify_member(row["service_member_id"], row, "refer")
    return jsonify({**row, "notified": sent, "notified_to": email if sent else None}), 200


def _run_rule_engine(
    cur: Any,
    assessment_id: str,
    service_member_id: str,
    type_: str,
    responses: dict[str, Any],
    phq9: int,
    pcl5: int,
) -> list[dict[str, Any]]:
    """
    Persist red flags for a submitted assessment and update deployability.

    Runs on the caller's transaction cursor (`cur`) so it commits atomically with
    the assessment insert — never on its own.
    """

    flags = rules.evaluate(responses, phq9, pcl5)

    # Supersede the soldier's prior unresolved flags for THIS assessment type, so
    # resubmitting the same questionnaire doesn't pile up stale flags (which would
    # drift out of sync with the deployable status set below). Flags from other
    # types — e.g. a PRE the provider is still actioning — are left untouched.
    cur.execute(
        """
        UPDATE red_flags SET resolved_at = now()
        WHERE resolved_at IS NULL
          AND assessment_id IN (
            SELECT id FROM assessments
            WHERE service_member_id = %s AND type = %s
          )
        """,
        (service_member_id, type_),
    )

    inserted = []
    for f in flags:
        cur.execute(
            """
            INSERT INTO red_flags (assessment_id, type, severity, rule_fired, message)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                assessment_id,
                f["type"],
                f["severity"],
                f["rule_fired"],
                f["message"],
            ),
        )
        inserted.append(cur.fetchone())

    deployable, reason = rules.deployability(flags)
    cur.execute(
        "UPDATE service_members SET deployable = %s, deployable_reason = %s WHERE id = %s",
        (deployable, reason, service_member_id),
    )
    return inserted
