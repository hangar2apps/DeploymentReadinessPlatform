"""
In-process RAG policy assistant.

Pipeline:
  - ingest_document: extract PDF text -> chunk -> embed -> store in document_chunks
  - ask_policy:      embed question -> pgvector similarity search -> LLM answer + citations
  - list_documents:  group document_chunks by document
"""

import io
import uuid
from typing import Any, Optional

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

import db

# OpenAI clients read OPENAI_API_KEY from the environment, which config.py has
# already loaded from the root .env by the time these are first used.
_EMBED_MODEL = "text-embedding-3-small"
_LLM_MODEL = "gpt-4o-mini"

# Created lazily so importing this module stays side-effect free (mirrors db.py).
# One embedding client and one LLM client are reused across requests.
_embeddings: Optional[OpenAIEmbeddings] = None
_llm: Optional[ChatOpenAI] = None
_schema_ready = False


def _get_embeddings() -> OpenAIEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = OpenAIEmbeddings(model=_EMBED_MODEL)
    return _embeddings


def _get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(model=_LLM_MODEL, temperature=0)
    return _llm


def ensure_schema() -> None:
    """
    Create the pgvector extension and document_chunks table if they don't exist.

    Idempotent and cached after the first success. The gRPC server did this once
    at startup; we defer it to the first ingest so app import and the test suite
    never require a live database.
    """

    global _schema_ready
    if _schema_ready:
        return
    with db.get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS document_chunks (
                    id SERIAL PRIMARY KEY,
                    document_id VARCHAR(255),
                    content TEXT NOT NULL,
                    source VARCHAR(255),
                    page_number INTEGER,
                    chunk_index INTEGER,
                    embedding vector(1536)
                )
            """)
        conn.commit()
    _schema_ready = True


def ingest_document(
    filename: str, content: bytes, doc_type: str = ""
) -> dict[str, Any]:
    """
    Chunk, embed, and store a PDF. Returns {document_id, chunks_created, status}.

    `content` is the raw PDF bytes. All chunk inserts run in a single transaction.
    """

    ensure_schema()

    reader = PdfReader(io.BytesIO(content))
    text = ""
    for page in reader.pages:
        text += page.extract_text()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        length_function=len,
    )
    chunks = splitter.split_text(text)

    embeddings = _get_embeddings()
    doc_id = str(uuid.uuid4())

    with db.get_conn() as conn:
        try:
            with conn.cursor() as cur:
                for i, chunk in enumerate(chunks):
                    embedding = embeddings.embed_query(chunk)
                    cur.execute(
                        """INSERT INTO document_chunks
                        (document_id, content, source, chunk_index, embedding)
                        VALUES (%s, %s, %s, %s, %s)""",
                        (doc_id, chunk, filename, i, str(embedding)),
                    )
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    return {
        "document_id": doc_id,
        "chunks_created": len(chunks),
        "status": "complete",
    }


def ask_policy(question: str, max_chunks: int = 5) -> dict[str, Any]:
    """
    Answer a question grounded in the ingested documents.

    Returns {answer, sources:[{document_name, chunk_text, similarity_score}]}.
    """

    embeddings = _get_embeddings()
    query_embedding = embeddings.embed_query(question)

    # pgvector cosine-distance search: <=> is distance, so 1 - distance is similarity.
    rows = db.query(
        """
        SELECT content, source, 1 - (embedding <=> %s) AS similarity
        FROM document_chunks
        ORDER BY embedding <=> %s
        LIMIT %s
        """,
        (str(query_embedding), str(query_embedding), max_chunks or 5),
    )

    sources = []
    context_parts = []
    for row in rows:
        context_parts.append(row["content"])
        sources.append({
            "document_name": row["source"],
            "chunk_text": row["content"][:1000],
            "similarity_score": round(row["similarity"], 4),
        })

    context_str = "\n\n---\n\n".join(context_parts)

    prompt = f"""Answer the following question using the provided context.
    If the context only partially answers the question, provide what you can and note what's missing.

    CONTEXT:
    {context_str}

    QUESTION: {question}

    ANSWER:"""

    response = _get_llm().invoke(prompt)

    return {"answer": response.content, "sources": sources}


def list_documents() -> list[dict[str, Any]]:
    """
    List ingested documents, one row per document with its chunk count.
    """

    rows = db.query(
        """
        SELECT document_id, source, COUNT(*) AS chunk_count
        FROM document_chunks
        GROUP BY document_id, source
        """
    )

    return [
        {
            "document_id": row["document_id"],
            "filename": row["source"],
            "doc_type": "",  # would need a separate column populated at ingest
            "chunk_count": row["chunk_count"],
            "ingested_at": "",  # would need a separate column populated at ingest
        }
        for row in rows
    ]
