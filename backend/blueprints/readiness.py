"""Readiness routes — battalion rollup, trend, and red-flag summary."""

from datetime import date, timedelta
from typing import Optional

from flask import Blueprint, jsonify, request

import db
from blueprints.units import readiness_stats

bp = Blueprint("readiness", __name__)


def _default_unit_id() -> Optional[str]:
    """The battalion (top of the hierarchy) when no unit_id is supplied."""
    row = db.query_one("SELECT id FROM units WHERE parent_unit_id IS NULL LIMIT 1")
    return str(row["id"]) if row else None


def _unit_exists(unit_id: str) -> bool:
    """True when the supplied unit id exists."""
    row = db.query_one("SELECT id FROM units WHERE id = %s", (unit_id,))
    return bool(row)


def _pdhra_compliance(unit_id: str) -> float:
    """Share of members in the unit subtree with a certified PDHRA."""
    row = db.query_one(
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
    ) or {"total": 0, "compliant": 0}

    total = row["total"] or 0
    compliant = row["compliant"] or 0
    return round(100.0 * compliant / total, 1) if total else 0.0


def _synthetic_delta_from_last_week(stats: dict[str, float | int]) -> float:
    """Return a plausible demo delta in the absence of historical snapshots."""
    if not stats["assigned"]:
        return 0.0
    return -4.3


def _company_breakdown(unit_id: str) -> list[dict[str, str | int | float]]:
    """Return direct-child company readiness in the agreed frontend shape."""
    rows = db.query(
        "SELECT id, short_name FROM units WHERE parent_unit_id = %s ORDER BY name",
        (unit_id,),
    )
    companies = []
    for row in rows:
        stats = readiness_stats(str(row["id"]))
        companies.append(
            {
                "unit_id": str(row["id"]),
                "short_name": row["short_name"],
                "assigned": stats["assigned"],
                "deployable": stats["deployable"],
                "pct": stats["deployable_pct"],
            }
        )
    return companies


@bp.get("/api/readiness")
def readiness():
    """GET /api/readiness — KPI cards + per-company readiness."""
    unit_id = request.args.get("unit_id") or _default_unit_id()
    if not unit_id:
        return jsonify({"error": "no units found"}), 404
    if not _unit_exists(unit_id):
        return jsonify({"error": "unit not found"}), 404

    stats = readiness_stats(unit_id)
    return jsonify(
        {
            "unit_id": unit_id,
            "total_assigned": stats["assigned"],
            "deployable_count": stats["deployable"],
            "non_deployable_count": stats["non_deployable"],
            "pct_deployable": stats["deployable_pct"],
            "delta_from_last_week": _synthetic_delta_from_last_week(stats),
            "pdhra_compliance_pct": _pdhra_compliance(unit_id),
            "by_company": _company_breakdown(unit_id),
        }
    )


@bp.get("/api/readiness/trend")
def trend():
    """GET /api/readiness/trend — synthetic deployable-% time series."""
    unit_id = request.args.get("unit_id") or _default_unit_id()
    if not unit_id:
        return jsonify({"error": "no units found"}), 404
    if not _unit_exists(unit_id):
        return jsonify({"error": "unit not found"}), 404

    days = int(request.args.get("days", 90))
    current = readiness_stats(unit_id)["deployable_pct"]

    points = []
    today = date.today()
    for i in range(days, -1, -1):
        d = today - timedelta(days=i)
        offset = 6.0 * (i / days) if days else 0.0
        points.append({"date": d.isoformat(), "pct_deployable": round(current - offset, 1)})

    return jsonify(points)


@bp.get("/api/red-flags/summary")
def red_flags_summary():
    """GET /api/red-flags/summary — open red flags aggregated by dashboard category."""
    unit_id = request.args.get("unit_id") or _default_unit_id()
    if not unit_id:
        return jsonify({"error": "no units found"}), 404
    if not _unit_exists(unit_id):
        return jsonify({"error": "unit not found"}), 404

    rows = db.query(
        """
        WITH RECURSIVE subtree AS (
          SELECT id FROM units WHERE id = %s
          UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
        )
        SELECT
          CASE
            WHEN rf.type IN ('DENTAL_CLASS_3', 'DENTAL_CLASS_4') THEN 'Dental'
            WHEN rf.type IN ('PHQ9_ELEVATED', 'PHQ9_SELF_HARM', 'PCL5_ELEVATED', 'PHQ9_MILD') THEN 'Behavioral Health'
            WHEN rf.type = 'PREGNANCY' THEN 'Pregnancy'
            WHEN rf.type = 'PHA_EXPIRED' THEN 'PHA'
            WHEN rf.type = 'IMMUNIZATION_GAP' THEN 'Immunizations'
            WHEN rf.type = 'NEW_MEDICATION' THEN 'Medication'
            ELSE rf.type
          END                                                    AS category,
          rf.severity,
          COUNT(DISTINCT sm.id)                                  AS soldier_count,
          ARRAY_AGG(DISTINCT u.short_name ORDER BY u.short_name) AS units
        FROM red_flags rf
        JOIN assessments a      ON a.id = rf.assessment_id
        JOIN service_members sm ON sm.id = a.service_member_id
        JOIN units u            ON u.id = sm.unit_id
        WHERE rf.resolved_at IS NULL
          AND sm.unit_id IN (SELECT id FROM subtree)
        GROUP BY category, rf.severity
        ORDER BY
          CASE rf.severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
          soldier_count DESC,
          category
        """,
        (unit_id,),
    )
    return jsonify(rows)
