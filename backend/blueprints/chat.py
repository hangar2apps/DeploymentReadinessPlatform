"""
AI chat routes.

  POST /api/policy-chat     — RAG policy assistant (proxies to the Python gRPC service)
  POST /api/commander/chat  — commander data chat (SQL context -> LLM summary)

The commander chat queries the DRP database (NOT the policy documents) and is
bound by a HIPAA instruction: summarize by category and count, never name
individuals or surface specific medical details.
"""

import json
from typing import Any, Tuple
from flask import Blueprint, request, jsonify
from flask.wrappers import Response

import config
import db
import rag_client
from blueprints.units import readiness_stats

bp = Blueprint("chat", __name__, url_prefix="/api")

_HIPAA_GUARDRAIL = (
    "You are a readiness analyst assistant for a battalion commander. "
    "Answer using ONLY the structured data provided. "
    "Summarize by category and count. Do NOT include individual names, EDIPIs, "
    "or specific medical details. If the data does not cover the question, say so."
)


@bp.post("/policy-chat")
def policy_chat() -> Tuple[Response, int]:
    """
    Proxy a policy question to the RAG gRPC service and return answer + citations.
    """

    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    try:
        result = rag_client.ask_policy(question, max_chunks=body.get("max_chunks", 5))
    except Exception as e:  # gRPC service down / unreachable
        return jsonify({"error": f"policy assistant unavailable: {e}"}), 502
    return jsonify(result), 200


def _commander_context(unit_id: str) -> dict[str, Any]:
    """
    Build a HIPAA-safe, aggregate snapshot of the unit for the LLM prompt.
    """

    stats = readiness_stats(unit_id)

    companies = db.query(
        "SELECT id, short_name FROM units WHERE parent_unit_id = %s ORDER BY name",
        (unit_id,),
    )
    by_company = [
        {"unit": c["short_name"], **readiness_stats(str(c["id"]))} for c in companies
    ]

    red_flags = db.query(
        """
        WITH RECURSIVE subtree AS (
          SELECT id FROM units WHERE id = %s
          UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
        )
        SELECT rf.type, rf.severity, COUNT(DISTINCT sm.id) AS soldier_count
        FROM red_flags rf
        JOIN assessments a      ON a.id = rf.assessment_id
        JOIN service_members sm ON sm.id = a.service_member_id
        WHERE rf.resolved_at IS NULL AND sm.unit_id IN (SELECT id FROM subtree)
        GROUP BY rf.type, rf.severity
        ORDER BY soldier_count DESC
        """,
        (unit_id,),
    )

    return {
        "battalion": stats,
        "by_company": by_company,
        "red_flags_by_category": red_flags,
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

    # Lazy import so the module loads even if openai isn't installed yet.
    from openai import OpenAI

    client = OpenAI(api_key=config.OPENAI_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=config.OPENAI_MODEL,
            temperature=0,
            messages=[
                {"role": "system", "content": _HIPAA_GUARDRAIL},
                {
                    "role": "user",
                    "content": f"READINESS DATA (JSON):\n{json.dumps(context, default=str)}\n\n"
                    f"QUESTION: {question}",
                },
            ],
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
