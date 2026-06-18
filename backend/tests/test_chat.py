"""HTTP tests for AI chat routes.

Covers:
  POST /api/policy-chat    — RAG policy assistant
  POST /api/commander/chat — Commander data chat with HIPAA guardrail

All DB and OpenAI calls are mocked — no live connections required.

Run:
    cd backend
    uv run pytest tests/test_chat.py -v
"""

from unittest.mock import patch, MagicMock
import pytest

from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


_FAKE_STATS = {
    "assigned": 90,
    "deployable": 78,
    "non_deployable": 12,
    "deployable_pct": 86.7,
}

_FAKE_CONTEXT = {
    "battalion": _FAKE_STATS,
    "by_company": [],
    "non_deployable_by_reason": [],
}


def _make_completion(answer: str) -> MagicMock:
    """Return a mock OpenAI completion with the given answer text."""
    mock = MagicMock()
    mock.choices = [MagicMock()]
    mock.choices[0].message.content = answer
    return mock


# ---------------------------------------------------------------------------
# POST /api/policy-chat — input validation
# ---------------------------------------------------------------------------

class TestPolicyChatValidation:
    def test_missing_question_returns_400(self, client):
        r = client.post("/api/policy-chat", json={})
        assert r.status_code == 400
        assert r.get_json()["error"] == "question is required"

    def test_whitespace_only_question_returns_400(self, client):
        r = client.post("/api/policy-chat", json={"question": "   "})
        assert r.status_code == 400
        assert r.get_json()["error"] == "question is required"

    def test_empty_body_returns_400(self, client):
        r = client.post("/api/policy-chat", data="", content_type="application/json")
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/policy-chat — success and pass-through
# ---------------------------------------------------------------------------

class TestPolicyChatSuccess:
    def test_returns_200_with_answer_and_sources(self, client):
        result = {
            "answer": "The policy states retention is 12 months.",
            "sources": [
                {
                    "document_name": "ar40-501.pdf",
                    "chunk_text": "Retention is 12 months.",
                    "similarity_score": 0.92,
                }
            ],
        }
        with patch("blueprints.chat.rag.ask_policy", return_value=result):
            r = client.post("/api/policy-chat", json={"question": "What is the retention policy?"})
        assert r.status_code == 200
        data = r.get_json()
        assert data["answer"] == result["answer"]
        assert data["sources"] == result["sources"]

    def test_passes_question_to_rag(self, client):
        with patch("blueprints.chat.rag.ask_policy", return_value={"answer": "ok", "sources": []}) as mock_ask:
            client.post("/api/policy-chat", json={"question": "What is the dental policy?"})
        mock_ask.assert_called_once()
        assert mock_ask.call_args.args[0] == "What is the dental policy?"

    def test_uses_default_max_chunks_of_5(self, client):
        with patch("blueprints.chat.rag.ask_policy", return_value={"answer": "ok", "sources": []}) as mock_ask:
            client.post("/api/policy-chat", json={"question": "test"})
        assert mock_ask.call_args.kwargs["max_chunks"] == 5

    def test_passes_custom_max_chunks_to_rag(self, client):
        with patch("blueprints.chat.rag.ask_policy", return_value={"answer": "ok", "sources": []}) as mock_ask:
            client.post("/api/policy-chat", json={"question": "test", "max_chunks": 10})
        assert mock_ask.call_args.kwargs["max_chunks"] == 10


# ---------------------------------------------------------------------------
# POST /api/policy-chat — error handling
# ---------------------------------------------------------------------------

class TestPolicyChatErrors:
    def test_rag_exception_returns_502(self, client):
        with patch("blueprints.chat.rag.ask_policy", side_effect=RuntimeError("db down")):
            r = client.post("/api/policy-chat", json={"question": "What is the policy?"})
        assert r.status_code == 502
        assert "policy assistant unavailable" in r.get_json()["error"]

    def test_502_error_includes_original_message(self, client):
        with patch("blueprints.chat.rag.ask_policy", side_effect=ConnectionError("OpenAI timeout")):
            r = client.post("/api/policy-chat", json={"question": "test"})
        assert "OpenAI timeout" in r.get_json()["error"]


# ---------------------------------------------------------------------------
# POST /api/commander/chat — input validation
# ---------------------------------------------------------------------------

class TestCommanderChatValidation:
    def test_missing_question_returns_400(self, client):
        r = client.post("/api/commander/chat", json={"unit_id": "bn-1"})
        assert r.status_code == 400
        assert r.get_json()["error"] == "question is required"

    def test_whitespace_question_returns_400(self, client):
        r = client.post("/api/commander/chat", json={"question": "  ", "unit_id": "bn-1"})
        assert r.status_code == 400

    def test_empty_body_returns_400(self, client):
        r = client.post("/api/commander/chat", data="", content_type="application/json")
        assert r.status_code == 400

    def test_no_units_in_db_returns_404(self, client):
        with patch("blueprints.chat.db.query_one", return_value=None):
            r = client.post("/api/commander/chat", json={"question": "How many deployable?"})
        assert r.status_code == 404
        assert r.get_json()["error"] == "no units found"


# ---------------------------------------------------------------------------
# POST /api/commander/chat — success
# ---------------------------------------------------------------------------

class TestCommanderChatSuccess:
    def test_returns_200_with_answer_context_and_unit_id(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = (
                _make_completion("78 of 90 are deployable.")
            )
            r = client.post("/api/commander/chat", json={"question": "What is readiness?", "unit_id": "bn-1"})
        assert r.status_code == 200
        data = r.get_json()
        assert "answer" in data
        assert "context" in data
        assert "unit_id" in data

    def test_answer_comes_from_llm(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = (
                _make_completion("Exactly 78 soldiers are deployable.")
            )
            r = client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
        assert r.get_json()["answer"] == "Exactly 78 soldiers are deployable."

    def test_uses_provided_unit_id_in_response(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            r = client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
        assert r.get_json()["unit_id"] == "bn-1"

    def test_defaults_to_root_unit_when_no_unit_id_given(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-root"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            r = client.post("/api/commander/chat", json={"question": "Readiness?"})
        assert r.status_code == 200
        assert r.get_json()["unit_id"] == "bn-root"

    def test_context_included_in_response(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            r = client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
        assert r.get_json()["context"] == _FAKE_CONTEXT


# ---------------------------------------------------------------------------
# POST /api/commander/chat — HIPAA guardrail
# ---------------------------------------------------------------------------

class TestCommanderChatHipaaGuardrail:
    def test_system_message_present_in_llm_call(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
            messages = MockOpenAI.return_value.chat.completions.create.call_args.kwargs["messages"]
        system_msgs = [m for m in messages if m["role"] == "system"]
        assert len(system_msgs) == 1

    def test_hipaa_guardrail_forbids_individual_names(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
            messages = MockOpenAI.return_value.chat.completions.create.call_args.kwargs["messages"]
        system_content = next(m["content"] for m in messages if m["role"] == "system")
        assert "individual names" in system_content

    def test_hipaa_guardrail_requires_aggregate_summaries(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
            messages = MockOpenAI.return_value.chat.completions.create.call_args.kwargs["messages"]
        system_content = next(m["content"] for m in messages if m["role"] == "system")
        assert "category and count" in system_content

    def test_readiness_data_included_in_user_message(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
            messages = MockOpenAI.return_value.chat.completions.create.call_args.kwargs["messages"]
        user_msgs = [m["content"] for m in messages if m["role"] == "user"]
        assert any("READINESS DATA" in c for c in user_msgs)


# ---------------------------------------------------------------------------
# POST /api/commander/chat — conversation history replay
# ---------------------------------------------------------------------------

class TestCommanderChatHistory:
    def test_prior_turn_included_in_messages(self, client):
        history = [{"q": "What is Bravo's status?", "a": "Bravo has 5 non-deployable."}]
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            client.post(
                "/api/commander/chat",
                json={"question": "Why?", "unit_id": "bn-1", "history": history},
            )
            messages = MockOpenAI.return_value.chat.completions.create.call_args.kwargs["messages"]
        user_contents = [m["content"] for m in messages if m["role"] == "user"]
        assert any("Bravo" in c for c in user_contents)

    def test_history_capped_at_six_turns(self, client):
        history = [{"q": f"q{i}", "a": f"a{i}"} for i in range(20)]
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            client.post(
                "/api/commander/chat",
                json={"question": "Now?", "unit_id": "bn-1", "history": history},
            )
            messages = MockOpenAI.return_value.chat.completions.create.call_args.kwargs["messages"]
        # 1 system + ≤12 history messages (6 turns × q+a) + 1 current user = ≤14
        assert len(messages) <= 14

    def test_non_list_history_is_silently_ignored(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            r = client.post(
                "/api/commander/chat",
                json={"question": "Readiness?", "unit_id": "bn-1", "history": "not a list"},
            )
        assert r.status_code == 200

    def test_history_turn_with_only_question_included(self, client):
        history = [{"q": "prev q only"}]  # no "a" key
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.return_value = _make_completion("ok")
            r = client.post(
                "/api/commander/chat",
                json={"question": "Follow up?", "unit_id": "bn-1", "history": history},
            )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/commander/chat — error handling
# ---------------------------------------------------------------------------

class TestCommanderChatErrors:
    def test_llm_exception_returns_502(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.side_effect = RuntimeError("timeout")
            r = client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
        assert r.status_code == 502
        assert "LLM unavailable" in r.get_json()["error"]

    def test_502_error_includes_original_message(self, client):
        with patch("blueprints.chat._commander_context", return_value=_FAKE_CONTEXT), \
             patch("blueprints.chat.db.query_one", return_value={"id": "bn-1"}), \
             patch("openai.OpenAI") as MockOpenAI:
            MockOpenAI.return_value.chat.completions.create.side_effect = ConnectionError("rate limited")
            r = client.post("/api/commander/chat", json={"question": "Readiness?", "unit_id": "bn-1"})
        assert "rate limited" in r.get_json()["error"]