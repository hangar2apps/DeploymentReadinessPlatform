"""
Shared helpers for deployment notification logic.

Centralises the recursive-subtree query and the incomplete-item derivation so
notifications.py and scheduler.py stay in sync.
"""

import db


def get_subtree_members(unit_id: str) -> list[dict]:
    """
    Return all service members in unit_id and every unit beneath it in the
    hierarchy, joined with their unit's name and deployment_date.
    """
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


def incomplete_items_from_responses(responses: dict) -> list[str] | None:
    """
    Derive which pre-deployment checklist items are outstanding from the
    responses dict of the member's latest assessment.

    Returns a list of plain-text item labels, or None when nothing is
    specifically flagged (callers should fall back to the full generic
    checklist in that case).
    """
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
    return items or None


def latest_incomplete_items(member_id: str) -> list[str] | None:
    """
    Fetch the member's most recent assessment and derive incomplete items.
    Returns None when no assessment exists or nothing is flagged.
    """
    row = db.query_one(
        "SELECT responses FROM assessments WHERE service_member_id = %s "
        "ORDER BY created_at DESC LIMIT 1",
        (member_id,),
    )
    if not row or not row.get("responses"):
        return None
    return incomplete_items_from_responses(row["responses"])
