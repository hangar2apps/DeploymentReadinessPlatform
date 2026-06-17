"""Scoring + red-flag rule engine.

Runs server-side when an assessment is submitted:
  1. score()        — derive PHQ-9 and PCL-5 totals from the raw responses
  2. evaluate()     — apply each rule in CLAUDE_CODE_BUILD.md, return red flags
  3. deployability()— collapse the flags into a deployable / reason decision

The DB writes themselves live in blueprints/assessments.py; this module is
pure logic so it stays easy to test.
"""

from datetime import datetime, timedelta, date


def score(responses):
    """Return (phq9_score, pcl5_score) summed from the questionnaire answers.

    PHQ-9: keys phq9_q1..phq9_q9, each 0-3 (total 0-27).
    PCL-5: keys pcl5_q1..pcl5_q20, each 0-4 (total 0-80).
    Missing items count as 0 so a partial draft still scores.
    """
    phq9 = sum(int(responses.get(f"phq9_q{i}", 0) or 0) for i in range(1, 10))
    pcl5 = sum(int(responses.get(f"pcl5_q{i}", 0) or 0) for i in range(1, 21))
    return phq9, pcl5


def _months_ago(date_str, months=12):
    """True if date_str (ISO YYYY-MM-DD) is older than `months` months."""
    if not date_str:
        return False
    try:
        d = datetime.fromisoformat(str(date_str)[:10]).date()
    except ValueError:
        return False
    # Approximate a month as 30 days — good enough for the PHA-expiry check.
    return d < (date.today() - timedelta(days=months * 30))


def evaluate(responses, phq9_score, pcl5_score):
    """Apply the red-flag rules. Returns a list of flag dicts ready to insert.

    Each dict: {type, severity, rule_fired, message}.
    """
    flags = []

    def fire(type_, severity, rule_fired, message):
        flags.append(
            {
                "type": type_,
                "severity": severity,
                "rule_fired": rule_fired,
                "message": message,
            }
        )

    # --- PHQ-9 depression ---
    if phq9_score >= 10:
        fire(
            "PHQ9_ELEVATED",
            "HIGH",
            "phq9_score >= 10",
            f"PHQ-9 score {phq9_score} indicates moderate or greater depression",
        )
    elif phq9_score >= 5:
        fire(
            "PHQ9_MILD",
            "LOW",
            "phq9_score >= 5 AND < 10",
            f"PHQ-9 score {phq9_score} indicates mild depression",
        )

    # PHQ-9 question 9 — self-harm ideation (any positive response).
    if int(responses.get("phq9_q9", 0) or 0) > 0:
        fire(
            "PHQ9_SELF_HARM",
            "HIGH",
            "responses.phq9_q9 > 0",
            "Positive response to self-harm ideation question",
        )

    # --- PCL-5 PTSD ---
    if pcl5_score >= 31:
        fire(
            "PCL5_ELEVATED",
            "HIGH",
            "pcl5_score >= 31",
            f"PCL-5 score {pcl5_score} indicates probable PTSD",
        )

    # --- Dental ---
    dental_class = responses.get("dental_class")
    if dental_class == 3:
        fire("DENTAL_CLASS_3", "HIGH", "responses.dental_class == 3",
             "Dental Class 3 — non-deployable")
    elif dental_class == 4:
        fire("DENTAL_CLASS_4", "HIGH", "responses.dental_class == 4",
             "Dental Class 4 — requires dental exam")

    # --- PHA / immunizations ---
    if _months_ago(responses.get("last_pha_date")):
        fire(
            "PHA_EXPIRED",
            "MEDIUM",
            "responses.last_pha_date > 12 months ago",
            f"PHA expired — last completed {responses.get('last_pha_date')}",
        )

    if responses.get("immunizations_current") is False:
        fire("IMMUNIZATION_GAP", "MEDIUM", "responses.immunizations_current == false",
             "Immunization records incomplete or expired")

    # --- Pregnancy ---
    if responses.get("pregnancy") is True:
        fire("PREGNANCY", "HIGH", "responses.pregnancy == true",
             "Pregnancy — automatic non-deployable")

    # --- Medication ---
    if responses.get("new_medication") is True:
        fire("NEW_MEDICATION", "LOW", "responses.new_medication == true",
             "New medication started — provider review recommended")

    return flags


# Map a red-flag type to the deployable_reason category stored on service_members.
_REASON_BY_TYPE = {
    "PHQ9_ELEVATED": "Behavioral Health",
    "PHQ9_SELF_HARM": "Behavioral Health",
    "PCL5_ELEVATED": "Behavioral Health",
    "DENTAL_CLASS_3": "Dental",
    "DENTAL_CLASS_4": "Dental",
    "PREGNANCY": "Pregnancy",
}


def deployability(flags):
    """Collapse flags into (deployable, deployable_reason).

    Any HIGH-severity flag makes the member non-deployable. The reason is taken
    from the first HIGH flag that maps to a category.
    """
    high_flags = [f for f in flags if f["severity"] == "HIGH"]
    if not high_flags:
        return True, None
    for f in high_flags:
        reason = _REASON_BY_TYPE.get(f["type"])
        if reason:
            return False, reason
    return False, "Medical"
