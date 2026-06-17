"""Readiness routes — battalion rollup, trend, and red-flag summary.

Endpoints:
  GET /api/readiness            — KPIs + readiness by company
  GET /api/readiness/trend      — time-series for the dashboard chart
  GET /api/red-flags/summary    — open red flags aggregated by category
"""

from datetime import date, timedelta
from flask import Blueprint, request, jsonify

import db
from blueprints.units import readiness_stats

bp = Blueprint("readiness", __name__)


def _default_unit_id():
    """The battalion (top of the hierarchy) when no unit_id is supplied."""
    row = db.query_one("SELECT id FROM units WHERE parent_unit_id IS NULL LIMIT 1")
    return str(row["id"]) if row else None


@bp.get("/api/readiness")
def readiness():
    """KPI cards + per-company breakdown for the commander dashboard."""
    unit_id = request.args.get("unit_id") or _default_unit_id()
    if not unit_id:
        return jsonify({"error": "no units found"}), 404

    stats = readiness_stats(unit_id)

    # PDHRA compliance: share of members with a certified PDHRA assessment.
    pdhra = db.query_one(
        """
        WITH RECURSIVE subtree AS (
          SELECT id FROM units WHERE id = %s
          UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
        ),
        members AS (
          SELECT id FROM service_members WHERE unit_id IN (SELECT id FROM subtree)
        )
        SELECT
          (SELECT COUNT(*) FROM members) AS total,
          (SELECT COUNT(DISTINCT a.service_member_id)
             FROM assessments a
             WHERE a.service_member_id IN (SELECT id FROM members)
               AND a.type = 'PDHRA' AND a.status = 'CERTIFIED') AS compliant
        """,
        (unit_id,),
    )
    total = pdhra["total"] or 0
    pdhra_pct = round(100.0 * (pdhra["compliant"] or 0) / total, 1) if total else 0.0

    # Per-company breakdown (direct children of the requested unit).
    companies = db.query(
        "SELECT id, name, short_name FROM units WHERE parent_unit_id = %s ORDER BY name",
        (unit_id,),
    )
    by_company = []
    for c in companies:
        by_company.append({**c, "readiness": readiness_stats(str(c["id"]))})

    return jsonify(
        {
            "unit_id": unit_id,
            "kpis": {
                "deployable_pct": stats["deployable_pct"],
                "total_assigned": stats["assigned"],
                "non_deployable": stats["non_deployable"],
                "pdhra_compliance_pct": pdhra_pct,
            },
            "by_company": by_company,
        }
    )


@bp.get("/api/readiness/trend")
def trend():
    """Synthetic deployable-% time series ending today.

    There is no historical snapshot table in the schema, so we derive a
    plausible curve that lands on the unit's current deployable %. Replace with
    a real daily-snapshot query once snapshots are persisted.
    """
    unit_id = request.args.get("unit_id") or _default_unit_id()
    days = int(request.args.get("days", 90))
    current = readiness_stats(unit_id)["deployable_pct"] if unit_id else 0.0

    points = []
    today = date.today()
    for i in range(days, -1, -1):
        d = today - timedelta(days=i)
        # Gentle ramp from ~6 points below current up to the current value.
        offset = 6.0 * (i / days) if days else 0.0
        points.append({"date": d.isoformat(), "deployable_pct": round(current - offset, 1)})

    return jsonify({"unit_id": unit_id, "days": days, "points": points})


@bp.get("/api/red-flags/summary")
def red_flags_summary():
    """Open red flags aggregated by type/category for the 'Attention Required' panel."""
    unit_id = request.args.get("unit_id") or _default_unit_id()
    rows = db.query(
        """
        WITH RECURSIVE subtree AS (
          SELECT id FROM units WHERE id = %s
          UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
        )
        SELECT
          rf.type,
          rf.severity,
          COUNT(DISTINCT sm.id)                                AS soldier_count,
          ARRAY_AGG(DISTINCT u.short_name)                     AS units,
          MIN(rf.message)                                      AS sample_message
        FROM red_flags rf
        JOIN assessments a    ON a.id = rf.assessment_id
        JOIN service_members sm ON sm.id = a.service_member_id
        JOIN units u          ON u.id = sm.unit_id
        WHERE rf.resolved_at IS NULL
          AND sm.unit_id IN (SELECT id FROM subtree)
        GROUP BY rf.type, rf.severity
        ORDER BY
          CASE rf.severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
          soldier_count DESC
        """,
        (unit_id,),
    )
    return jsonify({"unit_id": unit_id, "categories": rows})
