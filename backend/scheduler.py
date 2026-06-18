"""
APScheduler background jobs.

start() is called from the application factory only when the SCHEDULER_ENABLED
environment variable is set to "true".  This prevents duplicate job firing in
multi-worker Gunicorn deployments , set it on exactly one worker (or use
gunicorn --preload so create_app runs once before forking).

The Flask dev reloader also double-starts processes; the SCHEDULER_ENABLED gate
means you opt in explicitly in development too.

Jobs:
  check_deployment_blasts — runs daily at 08:00 UTC.  Finds every unit whose
  deployment_date is exactly 90 days from today (UTC) and fires the email blast.
"""

import logging
import os
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.background import BackgroundScheduler  # type: ignore
from apscheduler.triggers.cron import CronTrigger  # type: ignore

import db
import email_service
from deployment_helpers import get_subtree_members, latest_incomplete_items

log = logging.getLogger(__name__)


def check_deployment_blasts() -> None:
    """Find units with a deployment date 90 days out (UTC) and blast their members."""
    today_utc = datetime.now(timezone.utc).date()
    target = today_utc + timedelta(days=90)

    units = db.query(
        "SELECT * FROM units WHERE deployment_date = %s", (target.isoformat(),)
    )
    if not units:
        log.info("90-day blast check: no units deploying on %s", target)
        return

    for unit in units:
        members = get_subtree_members(unit["id"])
        log.info("90-day blast: unit %s has %d members", unit["short_name"], len(members))
        for m in members:
            if not m.get("email"):
                log.warning("Skipping %s %s — no email", m.get("rank"), m.get("last_name"))
                continue
            incomplete = latest_incomplete_items(m["id"])
            days_until = (unit["deployment_date"] - today_utc).days
            email_service.send_deployment_blast(
                member=m,
                unit_name=unit["name"],
                deployment_date=str(unit["deployment_date"]),
                days_until=days_until,
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
