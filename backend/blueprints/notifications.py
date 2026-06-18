"""
Notification routes — manual email triggers for providers.

POST /api/units/:id/notify-deployment
    Fires the 90-day deployment blast for every service member in the unit
    subtree that has a deployment_date set.  Intended for manual testing and
    as the function the scheduler calls.

POST /api/assessments/:id/notify-referral
    Provider manually triggers the referral email for a single service member.
    Available when the assessment is SUBMITTED, UNDER_REVIEW, or REFERRED.
"""

from typing import Tuple
from uuid import UUID
from flask import Blueprint, jsonify
from flask.wrappers import Response

import db
import email_service

bp = Blueprint("notifications", __name__, url_prefix="/api")


# Recursive CTE — same pattern as units.py — walks the unit subtree.
_SUBTREE_MEMBERS_SQL = """
WITH RECURSIVE subtree AS (
    SELECT id FROM units WHERE id = %s
    UNION ALL
    SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
)
SELECT sm.*, u.name AS unit_name, u.deployment_date
FROM service_members sm
JOIN units u ON u.id = sm.unit_id
WHERE sm.unit_id IN (SELECT id FROM subtree)
  AND u.deployment_date IS NOT NULL
"""

_INCOMPLETE_ITEMS_SQL = """
SELECT a.responses, a.referral_type
FROM assessments a
WHERE a.service_member_id = %s
ORDER BY a.created_at DESC
LIMIT 1
"""


def _incomplete_from_responses(responses: dict) -> list[str]:
    """Derive which checklist items are outstanding from the latest assessment responses."""
    items = []
    dental = responses.get("dental_class")
    if dental in (3, 4):
        items.append(f"Dental exam — currently Class {dental}, must reach Class 1 or 2")
    if responses.get("immunizations_current") is False:
        items.append("Immunizations current (anthrax, smallpox, and theater-specific)")
    if responses.get("pregnancy") is True or responses.get("pregnancy_status") == "yes":
        items.append("Pregnancy status — follow-up required with provider")
    if responses.get("last_pha_date") is None:
        items.append("Pre-Deployment Health Assessment (DD 2795)")
    return items or None  # None triggers the full generic checklist in email_service


@bp.post("/units/<uuid:unit_id>/notify-deployment")
def notify_deployment(unit_id: UUID) -> Tuple[Response, int]:
    """
    POST /api/units/:id/notify-deployment
    Sends 90-day blast to all members in the unit subtree that have a
    deployment_date on their unit.  Safe to call multiple times — SendGrid
    handles deduplication at the relay level.
    """
    unit = db.query_one("SELECT * FROM units WHERE id = %s", (str(unit_id),))
    if not unit:
        return jsonify({"error": "unit not found"}), 404

    members = db.query(_SUBTREE_MEMBERS_SQL, (str(unit_id),))
    if not members:
        return jsonify({"sent": 0, "skipped": 0, "reason": "no members with deployment_date found"}), 200

    sent, skipped = 0, 0
    for m in members:
        latest = db.query_one(_INCOMPLETE_ITEMS_SQL, (m["id"],))
        incomplete = None
        if latest and latest.get("responses"):
            incomplete = _incomplete_from_responses(latest["responses"])

        deployment_date = str(m["deployment_date"]) if m.get("deployment_date") else "TBD"
        email_service.send_deployment_blast(
            member=m,
            unit_name=m["unit_name"],
            deployment_date=deployment_date,
            incomplete_items=incomplete,
        )
        if m.get("email"):
            sent += 1
        else:
            skipped += 1

    return jsonify({"sent": sent, "skipped": skipped}), 200


@bp.post("/assessments/<uuid:assessment_id>/notify-referral")
def notify_referral(assessment_id: UUID) -> Tuple[Response, int]:
    """
    POST /api/assessments/:id/notify-referral
    Provider manually triggers the referral/incomplete-item notification for
    one service member.  Available for SUBMITTED, UNDER_REVIEW, and REFERRED
    assessments.
    """
    assessment = db.query_one(
        "SELECT * FROM assessments WHERE id = %s", (str(assessment_id),)
    )
    if not assessment:
        return jsonify({"error": "assessment not found"}), 404

    allowed_statuses = {"SUBMITTED", "UNDER_REVIEW", "REFERRED"}
    if assessment["status"] not in allowed_statuses:
        return jsonify({"error": f"cannot notify on a {assessment['status']} assessment"}), 422

    member = db.query_one(
        "SELECT sm.*, u.name AS unit_name FROM service_members sm JOIN units u ON u.id = sm.unit_id WHERE sm.id = %s",
        (assessment["service_member_id"],),
    )
    if not member:
        return jsonify({"error": "service member not found"}), 404

    if not member.get("email"):
        return jsonify({"error": "service member has no email address on record"}), 422

    email_service.send_referral_notification(member=member, assessment=assessment)
    return jsonify({"sent": True, "to": member["email"]}), 200
