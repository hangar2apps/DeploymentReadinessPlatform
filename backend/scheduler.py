"""
APScheduler background jobs.

start() is called once from the application factory (app.py).  The scheduler
runs in a background thread inside the same Gunicorn worker, so no separate
process is needed.

Jobs:
  check_deployment_blasts — runs daily at 08:00 UTC.  Finds every unit whose
  deployment_date is exactly 90 days from today and fires the email blast.
"""

import logging
from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler  # type: ignore
from apscheduler.triggers.cron import CronTrigger  # type: ignore

import db
import email_service

log = logging.getLogger(__name__)


def _members_for_unit(unit_id: str) -> list[dict]:
    return db.query(
        """
        WITH RECURSIVE subtree AS (
            SELECT id FROM units WHERE id = %s
            UNION ALL
            SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
        )
        SELECT sm.*, u.name AS unit_name, u.deployment_date
        FROM service_members sm
        JOIN units u ON u.id = sm.unit_id
        WHERE sm.unit_id IN (SELECT id FROM subtree)
        """,
        (unit_id,),
    )


def _incomplete_items(member_id: str) -> list[str] | None:
    latest = db.query_one(
        "SELECT responses FROM assessments WHERE service_member_id = %s ORDER BY created_at DESC LIMIT 1",
        (member_id,),
    )
    if not latest or not latest.get("responses"):
        return None
    r = latest["responses"]
    items = []
    dental = r.get("dental_class")
    if dental in (3, 4):
        items.append(f"Dental exam — currently Class {dental}, must reach Class 1 or 2")
    if r.get("immunizations_current") is False:
        items.append("Immunizations current (anthrax, smallpox, and theater-specific)")
    if r.get("pregnancy") is True or r.get("pregnancy_status") == "yes":
        items.append("Pregnancy status — follow-up required with provider")
    if r.get("last_pha_date") is None:
        items.append("Pre-Deployment Health Assessment (DD 2795)")
    return items or None


def check_deployment_blasts() -> None:
    """Find units with a deployment date 90 days out and blast their members."""
    target = date.today() + timedelta(days=90)
    units = db.query(
        "SELECT * FROM units WHERE deployment_date = %s", (target.isoformat(),)
    )
    if not units:
        log.info("90-day blast check: no units deploying on %s", target)
        return

    for unit in units:
        members = _members_for_unit(unit["id"])
        log.info("90-day blast: unit %s has %d members", unit["short_name"], len(members))
        for m in members:
            incomplete = _incomplete_items(m["id"])
            email_service.send_deployment_blast(
                member=m,
                unit_name=unit["name"],
                deployment_date=str(unit["deployment_date"]),
                incomplete_items=incomplete,
            )


def start() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        check_deployment_blasts,
        CronTrigger(hour=8, minute=0, timezone="UTC"),
        id="deployment_blast",
        replace_existing=True,
    )
    scheduler.start()
    log.info("Scheduler started — deployment blast job registered (daily 08:00 UTC)")
    return scheduler
