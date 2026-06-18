"""
AI chat routes.

  POST /api/policy-chat     — RAG policy assistant (in-process RAG over policy docs)
  POST /api/commander/chat  — commander data chat (SQL context -> LLM summary)

The commander chat queries the DRP database (NOT the policy documents) and is bound by a HIPAA instruction: summarize by category and count, never name individuals or surface specific medical details.
"""

import json
from typing import Any, Tuple
from flask import Blueprint, request, jsonify
from flask.wrappers import Response

import config
import db
import rag
from blueprints.units import readiness_stats

bp = Blueprint("chat", __name__, url_prefix="/api")

# This is here in case the provider adds some HIPPA data in there.  There won't be any data coming from this application directly.
_HIPAA_GUARDRAIL = "You are a readiness analyst assistant for a battalion commander. Answer using ONLY the structured data provided. Summarize by category and count. Do NOT include individual names, EDIPIs, or specific medical details. If the data does not cover the question, say so. Lead with a one-sentence answer. Use a short bulleted list (lines starting with '- ') only when listing multiple companies or categories — never bullet a single statement. You may use **bold** for labels. Do not use '#' headers or tables."

# How many prior turns of the conversation to replay so follow-up questions
# ("those soldiers", "what about Bravo") resolve. Bounds the prompt size.
_MAX_HISTORY_TURNS = 6


@bp.post("/policy-chat")
def policy_chat() -> Tuple[Response, int]:
    """
    Answer a policy question via in-process RAG and return answer + citations.
    """

    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    try:
        result = rag.ask_policy(question, max_chunks=body.get("max_chunks", 5))
    except Exception as e:  # DB or OpenAI unreachable
        return jsonify({"error": f"policy assistant unavailable: {e}"}), 502
    return jsonify(result), 200


def _commander_context(unit_id: str) -> dict[str, Any]:
    """
    Build a HIPAA-safe, aggregate snapshot of the unit for the LLM prompt.

    Everything is derived from service_members deployability (the same source of
    truth as the dashboard KPIs and the non-deployable roster), NOT the raw
    red_flags table. red_flags accumulate across resubmissions and aren't cleared
    when a soldier's status changes, so counting them would let the chat drift
    out of sync with what the commander sees on the dashboard.
    """

    stats = readiness_stats(unit_id)

    companies = db.query(
        "SELECT id, short_name FROM units WHERE parent_unit_id = %s ORDER BY name",
        (unit_id,),
    )

    # Per-company breakdown of the non-deployable soldiers by reason category, so
    # "why is C CO not at 100%?" is answered with the actual blockers — and the
    # counts always match the company's non-deployable roster.
    company_reason_rows = db.query(
        """
        SELECT u.short_name AS unit,
               COALESCE(sm.deployable_reason, 'Unspecified') AS reason,
               COUNT(*) AS soldier_count
        FROM service_members sm
        JOIN units u ON u.id = sm.unit_id
        WHERE NOT sm.deployable AND u.parent_unit_id = %s
        GROUP BY u.short_name, reason
        ORDER BY u.short_name, soldier_count DESC
        """,
        (unit_id,),
    )
    reasons_by_unit: dict[str, list[dict[str, Any]]] = {}
    for r in company_reason_rows:
        reasons_by_unit.setdefault(r["unit"], []).append({
            "reason": r["reason"],
            "soldier_count": r["soldier_count"],
        })

    by_company = [
        {
            "unit": c["short_name"],
            **readiness_stats(str(c["id"])),
            "non_deployable_by_reason": reasons_by_unit.get(c["short_name"], []),
        }
        for c in companies
    ]

    # Battalion-wide (subtree) non-deployable reasons.
    non_deployable_by_reason = db.query(
        """
        WITH RECURSIVE subtree AS (
          SELECT id FROM units WHERE id = %s
          UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
        )
        SELECT COALESCE(sm.deployable_reason, 'Unspecified') AS reason,
               COUNT(*) AS soldier_count
        FROM service_members sm
        WHERE NOT sm.deployable AND sm.unit_id IN (SELECT id FROM subtree)
        GROUP BY reason
        ORDER BY soldier_count DESC
        """,
        (unit_id,),
    )

    return {
        "battalion": stats,
        "by_company": by_company,
        "non_deployable_by_reason": non_deployable_by_reason,
    }


@bp.post("/commander/chat")
def commander_chat() -> Tuple[Response, int]:
    """
    Answer a commander's data question by summarizing DB context via the LLM.
    """

    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    unit_id = body.get("unit_id")
    if not unit_id:
        row = db.query_one("SELECT id FROM units WHERE parent_unit_id IS NULL LIMIT 1")
        unit_id = str(row["id"]) if row else None
    if not unit_id:
        return jsonify({"error": "no units found"}), 404

    context = _commander_context(unit_id)

    # Replay prior turns so follow-ups resolve ("those soldiers" -> the unit just
    # discussed). The fresh data JSON rides only on the current question to keep
    # history light and the latest numbers authoritative.
    messages: list[dict[str, str]] = [{"role": "system", "content": _HIPAA_GUARDRAIL}]
    history = body.get("history") or []
    if isinstance(history, list):
        for turn in history[-_MAX_HISTORY_TURNS:]:
            if not isinstance(turn, dict):
                continue
            q = (turn.get("q") or "").strip()
            a = (turn.get("a") or "").strip()
            if q:
                messages.append({"role": "user", "content": q})
            if a:
                messages.append({"role": "assistant", "content": a})
    messages.append({
        "role": "user",
        "content": f"READINESS DATA (JSON):\n{json.dumps(context, default=str)}\n\n"
        f"QUESTION: {question}",
    })

    # Lazy import so the module loads even if openai isn't installed yet.
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            temperature=0,
            messages=messages,
        )
        answer = completion.choices[0].message.content
    except Exception as e:
        return jsonify({"error": f"LLM unavailable: {e}"}), 502

    result = {
        "answer": answer,
        "unit_id": unit_id,
        "context": context,
    }

    return jsonify(result), 200
