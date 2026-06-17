"""gRPC client for the RAG policy assistant (rag-service/server.py).

The Query RPC server-streams QueryResponse messages: tokens accumulate and the
final message carries the source citations. We collect the full answer here and
return it as a single dict for the /api/policy-chat HTTP endpoint.
"""

import grpc

import config
import docintel_pb2
import docintel_pb2_grpc


def ask_policy(question, max_chunks=5):
    """Query the RAG service. Returns {answer, sources:[{document_name, chunk_text, similarity_score}]}."""
    with grpc.insecure_channel(config.RAG_GRPC_TARGET) as channel:
        stub = docintel_pb2_grpc.DocumentIntelligenceStub(channel)
        request = docintel_pb2.QueryRequest(question=question, max_chunks=max_chunks)

        answer_parts = []
        sources = []
        for response in stub.Query(request):
            if response.token:
                answer_parts.append(response.token)
            # Sources are populated on the final (done) message.
            if response.sources:
                sources = [
                    {
                        "document_name": s.document_name,
                        "chunk_text": s.chunk_text,
                        "similarity_score": round(s.similarity_score, 4),
                    }
                    for s in response.sources
                ]

        return {"answer": "".join(answer_parts), "sources": sources}
