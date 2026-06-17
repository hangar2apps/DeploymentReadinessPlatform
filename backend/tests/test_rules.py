"""Rule engine tests — no database or server required.

Tests cover every rule in backend-assessments.md: scoring, flag evaluation,
deployability mapping, boundary values, and all seeded non-deployable scenarios.

Run:
    cd backend
    uv run pytest tests/test_rules.py -v
"""

import pytest
import rules


# ---------------------------------------------------------------------------
# score()
# ---------------------------------------------------------------------------

class TestScore:
    def test_empty_responses_score_zero(self):
        assert rules.score({}) == (0, 0)

    def test_max_phq9(self):
        r = {f"phq9_q{i}": 3 for i in range(1, 10)}
        phq9, _ = rules.score(r)
        assert phq9 == 27

    def test_max_pcl5(self):
        r = {f"pcl5_q{i}": 4 for i in range(1, 21)}
        _, pcl5 = rules.score(r)
        assert pcl5 == 80

    def test_none_values_treated_as_zero(self):
        r = {"phq9_q1": None, "phq9_q2": 2}
        phq9, _ = rules.score(r)
        assert phq9 == 2

    def test_missing_items_treated_as_zero(self):
        r = {"phq9_q1": 3}   # only q1 present
        phq9, _ = rules.score(r)
        assert phq9 == 3


# ---------------------------------------------------------------------------
# evaluate() — each rule fires in isolation
# ---------------------------------------------------------------------------

def flag_types(responses, phq9=None, pcl5=None):
    """Helper: score and evaluate, return list of fired flag type strings."""
    phq9_s, pcl5_s = rules.score(responses)
    return [f["type"] for f in rules.evaluate(responses, phq9 if phq9 is not None else phq9_s, pcl5 if pcl5 is not None else pcl5_s)]


class TestPHQ9Rules:
    def test_elevated_fires_at_10(self):
        assert "PHQ9_ELEVATED" in flag_types({}, phq9=10)

    def test_elevated_does_not_fire_at_9(self):
        assert "PHQ9_ELEVATED" not in flag_types({}, phq9=9)

    def test_mild_fires_between_5_and_9(self):
        for score in (5, 7, 9):
            types = flag_types({}, phq9=score)
            assert "PHQ9_MILD" in types, f"Expected PHQ9_MILD at score {score}"
            assert "PHQ9_ELEVATED" not in types

    def test_mild_does_not_fire_below_5(self):
        assert "PHQ9_MILD" not in flag_types({}, phq9=4)

    def test_self_harm_fires_when_q9_positive(self):
        r = {f"phq9_q{i}": 0 for i in range(1, 10)}
        r["phq9_q9"] = 1
        assert "PHQ9_SELF_HARM" in flag_types(r)

    def test_self_harm_fires_independently_of_total_score(self):
        # q9=1 only → total score=1, below MILD threshold of 5
        r = {f"phq9_q{i}": 0 for i in range(1, 10)}
        r["phq9_q9"] = 1
        types = flag_types(r)
        assert "PHQ9_SELF_HARM" in types
        assert "PHQ9_MILD" not in types
        assert "PHQ9_ELEVATED" not in types

    def test_self_harm_does_not_fire_when_q9_zero(self):
        r = {f"phq9_q{i}": 2 for i in range(1, 10)}
        r["phq9_q9"] = 0
        assert "PHQ9_SELF_HARM" not in flag_types(r)


class TestPCL5Rules:
    def test_elevated_fires_at_31(self):
        assert "PCL5_ELEVATED" in flag_types({}, pcl5=31)

    def test_elevated_does_not_fire_at_30(self):
        assert "PCL5_ELEVATED" not in flag_types({}, pcl5=30)

    def test_elevated_fires_at_max(self):
        assert "PCL5_ELEVATED" in flag_types({}, pcl5=80)


class TestDentalRules:
    def test_class_3_fires_high(self):
        types = flag_types({"dental_class": 3})
        assert "DENTAL_CLASS_3" in types

    def test_class_4_fires_high(self):
        types = flag_types({"dental_class": 4})
        assert "DENTAL_CLASS_4" in types

    def test_class_1_does_not_fire(self):
        types = flag_types({"dental_class": 1})
        assert not any("DENTAL" in t for t in types)

    def test_class_2_does_not_fire(self):
        types = flag_types({"dental_class": 2})
        assert not any("DENTAL" in t for t in types)


class TestPHARule:
    def test_expired_pha_fires(self):
        assert "PHA_EXPIRED" in flag_types({"last_pha_date": "2024-01-01"})

    def test_recent_pha_does_not_fire(self):
        assert "PHA_EXPIRED" not in flag_types({"last_pha_date": "2025-12-01"})

    def test_missing_pha_date_does_not_fire(self):
        assert "PHA_EXPIRED" not in flag_types({})


class TestImmunizationRule:
    def test_not_current_fires(self):
        assert "IMMUNIZATION_GAP" in flag_types({"immunizations_current": False})

    def test_current_does_not_fire(self):
        assert "IMMUNIZATION_GAP" not in flag_types({"immunizations_current": True})

    def test_missing_key_does_not_fire(self):
        assert "IMMUNIZATION_GAP" not in flag_types({})


class TestPregnancyRule:
    def test_pregnancy_true_fires(self):
        assert "PREGNANCY" in flag_types({"pregnancy": True})

    def test_pregnancy_false_does_not_fire(self):
        assert "PREGNANCY" not in flag_types({"pregnancy": False})


class TestMedicationRule:
    def test_new_medication_fires(self):
        assert "NEW_MEDICATION" in flag_types({"new_medication": True})

    def test_no_medication_does_not_fire(self):
        assert "NEW_MEDICATION" not in flag_types({"new_medication": False})


class TestCleanAssessment:
    def test_no_flags_when_all_clear(self):
        r = {
            "dental_class": 1,
            "immunizations_current": True,
            "pregnancy": False,
            "new_medication": False,
            "last_pha_date": "2025-12-01",
        }
        assert flag_types(r) == []


# ---------------------------------------------------------------------------
# deployability()
# ---------------------------------------------------------------------------

class TestDeployability:
    def test_no_flags_deployable(self):
        deployable, reason = rules.deployability([])
        assert deployable is True
        assert reason is None

    def test_low_flag_only_still_deployable(self):
        flags = [{"type": "NEW_MEDICATION", "severity": "LOW", "rule_fired": "", "message": ""}]
        deployable, reason = rules.deployability(flags)
        assert deployable is True

    def test_medium_flag_only_still_deployable(self):
        flags = [{"type": "IMMUNIZATION_GAP", "severity": "MEDIUM", "rule_fired": "", "message": ""}]
        deployable, reason = rules.deployability(flags)
        assert deployable is True

    def test_high_flag_non_deployable(self):
        flags = [{"type": "DENTAL_CLASS_3", "severity": "HIGH", "rule_fired": "", "message": ""}]
        deployable, reason = rules.deployability(flags)
        assert deployable is False

    @pytest.mark.parametrize("flag_type,expected_reason", [
        ("PHQ9_ELEVATED",  "Behavioral Health"),
        ("PHQ9_SELF_HARM", "Behavioral Health"),
        ("PCL5_ELEVATED",  "Behavioral Health"),
        ("DENTAL_CLASS_3", "Dental"),
        ("DENTAL_CLASS_4", "Dental"),
        ("PREGNANCY",      "Pregnancy"),
    ])
    def test_reason_mapping(self, flag_type, expected_reason):
        flags = [{"type": flag_type, "severity": "HIGH", "rule_fired": "", "message": ""}]
        _, reason = rules.deployability(flags)
        assert reason == expected_reason

    def test_unlisted_high_flag_maps_to_medical(self):
        flags = [{"type": "UNKNOWN_HIGH", "severity": "HIGH", "rule_fired": "", "message": ""}]
        _, reason = rules.deployability(flags)
        assert reason == "Medical"

    def test_multi_flag_first_high_reason_wins(self):
        # PHQ9_ELEVATED comes before DENTAL_CLASS_3 in evaluate() output order
        r = {"dental_class": 3}
        r.update({f"phq9_q{i}": 2 for i in range(1, 10)})
        phq9, pcl5 = rules.score(r)
        flags = rules.evaluate(r, phq9, pcl5)
        _, reason = rules.deployability(flags)
        assert reason == "Behavioral Health"


# ---------------------------------------------------------------------------
# Seed scenario validation — engine must reproduce all 10 non-deployable cases
# ---------------------------------------------------------------------------

SEED_CASES = [
    # (description, responses, expected_flag_types, expected_reason)
    (
        "Bailey — PHQ-9 moderate (score 14) + self-harm",
        {
            "phq9_q1":2,"phq9_q2":2,"phq9_q3":2,"phq9_q4":2,"phq9_q5":2,
            "phq9_q6":1,"phq9_q7":1,"phq9_q8":1,"phq9_q9":1,
            "dental_class":1,"immunizations_current":True,"pregnancy":False,
        },
        ["PHQ9_ELEVATED","PHQ9_SELF_HARM"],
        "Behavioral Health",
    ),
    (
        "Mitchell — PCL-5 probable PTSD (score 35)",
        {
            "pcl5_q1":2,"pcl5_q2":2,"pcl5_q3":2,"pcl5_q4":2,"pcl5_q5":2,
            "pcl5_q6":1,"pcl5_q7":1,"pcl5_q8":2,"pcl5_q9":2,"pcl5_q10":2,
            "pcl5_q11":2,"pcl5_q12":2,"pcl5_q13":1,"pcl5_q14":1,"pcl5_q15":1,
            "pcl5_q16":1,"pcl5_q17":1,"pcl5_q18":1,"pcl5_q19":1,"pcl5_q20":2,
            "dental_class":1,"immunizations_current":True,"pregnancy":False,
        },
        ["PCL5_ELEVATED"],
        "Behavioral Health",
    ),
    (
        "Holt — PHQ-9 self-harm (q9=2, total < 10)",
        {
            "phq9_q1":1,"phq9_q2":1,"phq9_q3":1,
            "phq9_q4":0,"phq9_q5":0,"phq9_q6":0,"phq9_q7":0,"phq9_q8":0,"phq9_q9":2,
            "dental_class":1,"immunizations_current":True,"pregnancy":False,
        },
        ["PHQ9_SELF_HARM"],
        "Behavioral Health",
    ),
    (
        "Coleman — Dental Class 4",
        {"dental_class":4,"immunizations_current":True,"pregnancy":False},
        ["DENTAL_CLASS_4"],
        "Dental",
    ),
    (
        "Nguyen — Dental Class 3",
        {"dental_class":3,"immunizations_current":True,"pregnancy":False},
        ["DENTAL_CLASS_3"],
        "Dental",
    ),
    (
        "Foster — Dental Class 3",
        {"dental_class":3,"immunizations_current":True,"pregnancy":False},
        ["DENTAL_CLASS_3"],
        "Dental",
    ),
    (
        "Marsh — Dental Class 3",
        {"dental_class":3,"immunizations_current":True,"pregnancy":False},
        ["DENTAL_CLASS_3"],
        "Dental",
    ),
    (
        "Castillo — Dental Class 4",
        {"dental_class":4,"immunizations_current":True,"pregnancy":False},
        ["DENTAL_CLASS_4"],
        "Dental",
    ),
    (
        "Vargas — Pregnancy",
        {"pregnancy":True,"dental_class":1,"immunizations_current":True},
        ["PREGNANCY"],
        "Pregnancy",
    ),
    (
        "Reyes — Pregnancy",
        {"pregnancy":True,"dental_class":1,"immunizations_current":True},
        ["PREGNANCY"],
        "Pregnancy",
    ),
]


@pytest.mark.parametrize("label,responses,expected_flag_types,expected_reason", SEED_CASES, ids=[c[0] for c in SEED_CASES])
def test_seed_scenario(label, responses, expected_flag_types, expected_reason):
    phq9, pcl5 = rules.score(responses)
    flags = rules.evaluate(responses, phq9, pcl5)
    types = [f["type"] for f in flags]
    deployable, reason = rules.deployability(flags)

    for expected in expected_flag_types:
        assert expected in types, f"{label}: expected flag {expected}, got {types}"
    assert deployable is False, f"{label}: expected non-deployable"
    assert reason == expected_reason, f"{label}: expected reason={expected_reason}, got {reason}"
