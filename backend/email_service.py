"""
Email delivery via SendGrid.

Reads SENDGRID_API_KEY and SENDGRID_FROM_EMAIL from the environment.
Both functions are no-ops (log only) when the key is absent so local dev
doesn't require a live SendGrid account.
"""

import logging
import os
from html import escape

log = logging.getLogger(__name__)

_API_KEY = os.getenv("SENDGRID_API_KEY", "")
_FROM = os.getenv("SENDGRID_FROM_EMAIL", "noreply@drp.army.mil")

# Pre-deployment checklist items shown in the 90-day blast when no
# assessment-specific items can be derived.
_CHECKLIST_ITEMS = [
    "Pre-Deployment Health Assessment (DD 2795)",
    "Dental exam — must be Class 1 or 2",
    "Immunizations current (anthrax, smallpox, and theater-specific)",
    "PDHRA baseline completion",
    "Behavioral health screening",
    "Pregnancy status update (if applicable)",
    "Vision / hearing screening",
    "Review of current medications with provider",
]


def _send(to: str, subject: str, html: str) -> bool:
    """
    Low-level send. Returns True only if SendGrid accepted the message (2xx).

    Returns False (and logs) when no API key is configured or the send fails, so
    callers can report real delivery status instead of assuming success.
    """
    if not _API_KEY:
        log.warning("SENDGRID_API_KEY not set — skipping send to %s: %s", to, subject)
        return False

    try:
        import sendgrid  # type: ignore
        from sendgrid.helpers.mail import Mail  # type: ignore

        sg = sendgrid.SendGridAPIClient(api_key=_API_KEY)
        msg = Mail(
            from_email=_FROM,
            to_emails=to,
            subject=subject,
            html_content=html,
        )
        resp = sg.send(msg)
        log.info("SendGrid accepted %s -> %s (status %s)", subject, to, resp.status_code)
        return 200 <= resp.status_code < 300
    except Exception:
        log.exception("SendGrid send failed to %s", to)
        return False


# ---------------------------------------------------------------------------
# 90-day deployment blast
# ---------------------------------------------------------------------------

def send_deployment_blast(
    member: dict,
    unit_name: str,
    deployment_date: str,
    days_until: int | None = None,
    incomplete_items: list[str] | None = None,
) -> None:
    """
    Send the pre-deployment readiness notification to one service member.

    `incomplete_items` lists the specific items the member is missing from
    their latest assessment.  Falls back to the full generic checklist when
    None or empty.

    `days_until` is shown in the email body.  Callers should compute it from
    the actual deployment_date so the text is accurate regardless of when the
    email is sent.
    """
    email = member.get("email")
    if not email:
        log.warning(
            "No email for %s %s (id %s) — skipping",
            member.get("rank"), member.get("last_name"), member.get("id"),
        )
        return

    name = escape(
        f"{member.get('rank', '')} {member.get('first_name', '')} {member.get('last_name', '')}".strip()
    )
    unit_name_safe = escape(str(unit_name))
    deployment_date_safe = escape(str(deployment_date))
    days_text = escape(str(days_until)) if days_until is not None else "90"

    items = incomplete_items or _CHECKLIST_ITEMS
    items_html = "".join(
        f"<li style='margin:4px 0'>{escape(str(item))}</li>" for item in items
    )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1b3a6b;padding:20px 24px">
        <h1 style="color:#fff;margin:0;font-size:20px">Deployment Readiness Notification</h1>
      </div>
      <div style="padding:24px">
        <p>Dear {name},</p>
        <p>
          Your unit (<strong>{unit_name_safe}</strong>) has a deployment scheduled for
          <strong>{deployment_date_safe}</strong> — approximately
          <strong>{days_text} days</strong> from now.
        </p>
        <p>
          To be certified as deployable you must complete the following items
          <strong>before your unit's deployment date</strong>:
        </p>
        <ul style="padding-left:20px;line-height:1.6">
          {items_html}
        </ul>
        <p>
          Log in to the Deployment Readiness Platform to submit your Pre-Deployment
          Health Assessment and track your status. Contact your unit's medical
          provider if you have questions about any of these requirements.
        </p>
        <p style="margin-top:32px;font-size:12px;color:#666">
          This is an automated message from the Deployment Readiness Platform.
          Do not reply directly to this email.
        </p>
      </div>
    </div>
    """
    _send(email, f"[DRP] Deployment Readiness Notice — {unit_name}", html)


# ---------------------------------------------------------------------------
# Provider-triggered referral notification
# ---------------------------------------------------------------------------

def send_referral_notification(member: dict, assessment: dict) -> bool:
    """
    Notify a service member that their provider has flagged an incomplete or
    referred item on their assessment. Returns True if the email was sent.
    """
    email = member.get("email")
    if not email:
        log.warning(
            "No email for %s %s (id %s) — skipping",
            member.get("rank"), member.get("last_name"), member.get("id"),
        )
        return False

    name = escape(
        f"{member.get('rank', '')} {member.get('first_name', '')} {member.get('last_name', '')}".strip()
    )

    referral_type = assessment.get("referral_type") or "OTHER"
    type_display = escape({
        "BEHAVIORAL_HEALTH": "Behavioral Health",
        "DENTAL": "Dental",
        "MEDICAL": "Medical",
        "OTHER": "General Medical",
    }.get(referral_type, referral_type.replace("_", " ").title()))

    raw_notes = (assessment.get("referral_notes") or "").strip()
    notes_block = (
        f"<p><strong>Provider notes:</strong> {escape(raw_notes)}</p>"
        if raw_notes
        else ""
    )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1b3a6b;padding:20px 24px">
        <h1 style="color:#fff;margin:0;font-size:20px">Action Required — Deployment Readiness</h1>
      </div>
      <div style="padding:24px">
        <p>Dear {name},</p>
        <p>
          Your provider has reviewed your deployment health assessment and identified
          an item that requires your attention before you can be certified as deployable.
        </p>
        <div style="background:#fff3cd;border-left:4px solid #e6a817;padding:12px 16px;margin:16px 0;border-radius:4px">
          <strong>Category:</strong> {type_display}
        </div>
        {notes_block}
        <p>
          Please follow up with your unit&#39;s medical provider or the appropriate
          clinic as soon as possible to resolve this item. Your deployable status
          will be updated once the referral is resolved.
        </p>
        <p>
          Log in to the Deployment Readiness Platform to view the full details of
          your assessment.
        </p>
        <p style="margin-top:32px;font-size:12px;color:#666">
          This is an automated message from the Deployment Readiness Platform.
          Do not reply directly to this email.
        </p>
      </div>
    </div>
    """
    return _send(email, f"[DRP] Action Required: {type_display} Referral", html)


# ---------------------------------------------------------------------------
# Provider-triggered certification notification
# ---------------------------------------------------------------------------

def send_certification_notification(member: dict, assessment: dict) -> bool:
    """
    Notify a service member that their provider reviewed their assessment with no
    referral needed. The wording adapts to the form: a PRE (DD 2795) is a
    deployability clearance ("medically deployable"); a POST (DD 2796) or PDHRA
    (DD 2900) is a post-deployment review ("no follow-up needed"). Returns True
    if the email was sent.
    """
    email = member.get("email")
    if not email:
        log.warning(
            "No email for %s %s (id %s) — skipping",
            member.get("rank"), member.get("last_name"), member.get("id"),
        )
        return False

    name = escape(
        f"{member.get('rank', '')} {member.get('first_name', '')} {member.get('last_name', '')}".strip()
    )

    is_post = assessment.get("type") in ("POST", "PDHRA")
    if is_post:
        subject = "[DRP] Post-Deployment Health Assessment Reviewed"
        heading = "Post-Deployment Health Assessment Reviewed"
        lead = (
            "Your provider has <strong>reviewed</strong> your post-deployment health "
            "assessment and found no issues requiring a referral at this time."
        )
        status_label = "Reviewed — No Referral Needed"
        followup = (
            "No further action is required. If new symptoms develop or your health "
            "status changes, contact your unit&#39;s medical provider."
        )
    else:
        subject = "[DRP] Deployment Health Assessment Certified"
        heading = "Deployment Health Assessment Certified"
        lead = (
            "Your provider has reviewed and <strong>certified</strong> your deployment "
            "health assessment. You are currently <strong>medically deployable</strong>."
        )
        status_label = "Deployable"
        followup = (
            "No further action is required at this time. If your health status changes "
            "before your unit&#39;s deployment date, notify your unit&#39;s medical provider."
        )

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1b3a6b;padding:20px 24px">
        <h1 style="color:#fff;margin:0;font-size:20px">{heading}</h1>
      </div>
      <div style="padding:24px">
        <p>Dear {name},</p>
        <p>{lead}</p>
        <div style="background:#e6f4ea;border-left:4px solid #2e7d32;padding:12px 16px;margin:16px 0;border-radius:4px">
          <strong>Status:</strong> {status_label}
        </div>
        <p>{followup}</p>
        <p>
          Log in to the Deployment Readiness Platform to view your assessment details.
        </p>
        <p style="margin-top:32px;font-size:12px;color:#666">
          This is an automated message from the Deployment Readiness Platform.
          Do not reply directly to this email.
        </p>
      </div>
    </div>
    """
    return _send(email, subject, html)
