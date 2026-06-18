"""
Email delivery via SendGrid.

Reads SENDGRID_API_KEY and SENDGRID_FROM_EMAIL from the environment.
Both functions are no-ops (log only) when the key is absent so local dev
doesn't require a live SendGrid account.
"""

import logging
import os

log = logging.getLogger(__name__)

_API_KEY = os.getenv("SENDGRID_API_KEY", "")
_FROM = os.getenv("SENDGRID_FROM_EMAIL", "noreply@drp.army.mil")

# Pre-deployment checklist items shown in the 90-day blast.
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


def _send(to: str, subject: str, html: str) -> None:
    """Low-level send.  Falls back to a log line when no API key is configured."""
    if not _API_KEY:
        log.warning("SENDGRID_API_KEY not set — skipping send to %s: %s", to, subject)
        return

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
    except Exception:
        log.exception("SendGrid send failed to %s", to)


# ---------------------------------------------------------------------------
# 90-day deployment blast
# ---------------------------------------------------------------------------

def send_deployment_blast(
    member: dict,
    unit_name: str,
    deployment_date: str,
    incomplete_items: list[str] | None = None,
) -> None:
    """
    Send the 90-day pre-deployment readiness notification to one service member.

    `incomplete_items` is a list of plain-text item labels the member is known
    to be missing based on their latest assessment.  Falls back to the full
    generic checklist when None or empty.
    """
    email = member.get("email")
    if not email:
        log.warning("No email for %s %s (id %s) — skipping", member.get("rank"), member.get("last_name"), member.get("id"))
        return

    name = f"{member.get('rank', '')} {member.get('first_name', '')} {member.get('last_name', '')}".strip()
    items = incomplete_items or _CHECKLIST_ITEMS
    items_html = "".join(f"<li style='margin:4px 0'>{i}</li>" for i in items)

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1b3a6b;padding:20px 24px">
        <h1 style="color:#fff;margin:0;font-size:20px">Deployment Readiness Notification</h1>
      </div>
      <div style="padding:24px">
        <p>Dear {name},</p>
        <p>
          Your unit (<strong>{unit_name}</strong>) has a deployment scheduled for
          <strong>{deployment_date}</strong> — approximately <strong>90 days</strong> from now.
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
          Health Assessment and track your status.  Contact your unit's medical
          provider if you have questions about any of these requirements.
        </p>
        <p style="margin-top:32px;font-size:12px;color:#666">
          This is an automated message from the Deployment Readiness Platform.
          Do not reply directly to this email.
        </p>
      </div>
    </div>
    """
    _send(email, f"[DRP] 90-Day Deployment Readiness Notice — {unit_name}", html)


# ---------------------------------------------------------------------------
# Provider-triggered referral notification
# ---------------------------------------------------------------------------

def send_referral_notification(member: dict, assessment: dict) -> None:
    """
    Notify a service member that their provider has flagged an incomplete or
    referred item on their assessment.
    """
    email = member.get("email")
    if not email:
        log.warning("No email for %s %s (id %s) — skipping", member.get("rank"), member.get("last_name"), member.get("id"))
        return

    name = f"{member.get('rank', '')} {member.get('first_name', '')} {member.get('last_name', '')}".strip()

    referral_type = assessment.get("referral_type") or "General"
    referral_notes = assessment.get("referral_notes") or ""
    notes_block = (
        f"<p><strong>Provider notes:</strong> {referral_notes}</p>"
        if referral_notes
        else ""
    )

    type_display = {
        "BEHAVIORAL_HEALTH": "Behavioral Health",
        "DENTAL": "Dental",
        "MEDICAL": "Medical",
        "OTHER": "General Medical",
    }.get(referral_type, referral_type.replace("_", " ").title())

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
          Please follow up with your unit's medical provider or the appropriate
          clinic as soon as possible to resolve this item.  Your deployable status
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
    _send(email, f"[DRP] Action Required: {type_display} Referral", html)
