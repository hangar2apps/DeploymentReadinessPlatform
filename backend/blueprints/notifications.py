"""
Notification routes — manual email triggers for providers.

POST /api/units/:id/notify-deployment
    Fires the pre-deployment blast for every service member in the unit
    subtree.  The unit must have a deployment_date set.  "sent" in the
    response means the member had an email address and a send was attempted;
    SendGrid delivery is fire-and-forget from this endpoint.

POST /api/assessments/:id/notify-referral
    Provider manually triggers the referral email for a single service member.
    Available when the assessment is SUBMITTED, UNDER_REVIEW, or REFERRED.
    Records a timestamp on the assessment to prevent duplicate sends — a second
    call within the same session returns 409.
"""

from datetime import datetime, timezone, timedelta
from typing import Tuple
from uuid import UUID
from flask import Blueprint, jsonify
from flask.wrappers import Response

import auth
import db
import email_service
from deployment_helpers import get_subtree_members, latest_incomplete_items

bp = Blueprint("notifications", __name__, url_prefix="/api")


@bp.post("/units/<uuid:unit_id>/notify-deployment")
@auth.require_role(auth.ROLE_PROVIDER, auth.ROLE_COMMANDER)
def notify_deployment(unit_id: UUID) -> Tuple[Response, int]:
    # Same scoping as GET /api/units/:id — a provider/commander may only blast a
    # unit within their own command subtree (raises 403 otherwise).
    auth.scope_unit(str(unit_id))
    unit = db.query_one("SELECT * FROM units WHERE id = %s", (str(unit_id),))
    if not unit:
        return jsonify({"error": "unit not found"}), 404
    if not unit.get("deployment_date"):
        return jsonify({"error": "unit has no deployment_date set"}), 422

    today_utc = datetime.now(timezone.utc).date()
    days_until = (unit["deployment_date"] - today_utc).days

    members = get_subtree_members(str(unit_id))
    if not members:
        return jsonify({"sent": 0, "skipped": 0}), 200

    sent, skipped = 0, 0
    for m in members:
        if not m.get("email"):
            skipped += 1
            continue
        incomplete = latest_incomplete_items(m["id"])
        email_service.send_deployment_blast(
            member=m,
            unit_name=unit["name"],
            deployment_date=str(unit["deployment_date"]),
            days_until=days_until,
            incomplete_items=incomplete,
        )
        sent += 1

    return jsonify({"sent": sent, "skipped": skipped}), 200


@bp.post("/assessments/<uuid:assessment_id>/notify-referral")
@auth.require_role(auth.ROLE_PROVIDER, auth.ROLE_COMMANDER)
def notify_referral(assessment_id: UUID) -> Tuple[Response, int]:
    # Role-gated like the sibling certify/refer actions in the assessments
    # blueprint, which also email the member on a per-assessment decision.
    assessment = db.query_one(
        "SELECT * FROM assessments WHERE id = %s", (str(assessment_id),)
    )
    if not assessment:
        return jsonify({"error": "assessment not found"}), 404

    allowed_statuses = {"SUBMITTED", "UNDER_REVIEW", "REFERRED"}
    if assessment["status"] not in allowed_statuses:
        return jsonify({"error": f"cannot notify on a {assessment['status']} assessment"}), 422

    if assessment.get("referral_notified_at"):
        return jsonify({
            "error": "notification already sent",
            "sent_at": str(assessment["referral_notified_at"]),
        }), 409

    member = db.query_one(
        """
        SELECT sm.*, u.name AS unit_name
        FROM service_members sm
        JOIN units u ON u.id = sm.unit_id
        WHERE sm.id = %s
        """,
        (assessment["service_member_id"],),
    )
    if not member:
        return jsonify({"error": "service member not found"}), 404
    if not member.get("email"):
        return jsonify({"error": "service member has no email address on record"}), 422

    sent = email_service.send_referral_notification(member=member, assessment=assessment)
    if not sent:
        # Don't record the timestamp on failure, so the provider can retry once
        # the email service is fixed (a recorded send would 409 the next attempt).
        return jsonify({
            "error": "email delivery failed — check the email service configuration",
        }), 502

    db.execute(
        "UPDATE assessments SET referral_notified_at = %s WHERE id = %s",
        (datetime.now(timezone.utc), str(assessment_id)),
        returning=False,
    )

    return jsonify({"sent": True, "to": member["email"]}), 200
