"""
Production FastAPI Application for Healthcare RAG Module V2.
Exposes /chat, /retrieve, and /health endpoints with structured provenance and safety.
"""
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline

app = FastAPI(
    title="Healthcare Medical RAG Intelligence API",
    description="Evidence-grounded medical question answering API with multi-stage hybrid retrieval, clinical safety guardrails, and citation tracking.",
    version="2.0.0"
)

# Global singleton pipeline instance
_pipeline: Optional[MedicalRAGPipeline] = None


def get_pipeline() -> MedicalRAGPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = MedicalRAGPipeline()
    return _pipeline


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Patient or clinician medical question")
    mode: Optional[str] = Field("hybrid", description="Retrieval mode: dense, bm25, hybrid, or hybrid_rerank")
    generate_answer: Optional[bool] = Field(True, description="Whether to invoke LLM for answer generation")


class CitationItem(BaseModel):
    source_index: int
    title: str
    source_name: str
    publisher: str
    url: str
    chunk_id: str
    qtype: str
    score: float


class QueryResponse(BaseModel):
    question: str
    answer: str
    is_emergency: bool
    abstained: bool
    sources: List[CitationItem]
    retrieved_chunks_count: int
    pipeline_mode: str


@app.get("/health")
def health_check():
    """Returns system status, index health, and configuration metadata."""
    pipeline = get_pipeline()
    total_vectors = pipeline.dense_retriever.index.ntotal if pipeline.dense_retriever else 0
    total_chunks = len(pipeline.dense_retriever.metadata) if pipeline.dense_retriever else 0
    return {
        "status": "healthy",
        "version": "2.0.0",
        "vector_index": "FAISS IndexFlatIP",
        "embedding_model": DEFAULT_CONFIG.EMBEDDING_MODEL_NAME,
        "indexed_vectors_count": total_vectors,
        "indexed_chunks_count": total_chunks,
        "bm25_active": pipeline.bm25_retriever is not None,
        "hybrid_active": pipeline.hybrid_retriever is not None,
        "safety_guardrails_enabled": DEFAULT_CONFIG.ENABLE_SAFETY_GUARDRAILS
    }


@app.post("/chat", response_model=QueryResponse)
def chat_endpoint(request: QueryRequest):
    """
    Processes medical queries through the full RAG pipeline:
    1. Emergency symptom triage
    2. Input sanitization
    3. Multi-stage Hybrid Retrieval (FAISS Dense + BM25 Lexical)
    4. Second-stage Cross-Encoder Reranking
    5. Abstention gating on low similarity
    6. Grounded Context Construction with numbered citations
    7. LLM Answer Generation with clinical disclaimer
    """
    try:
        pipeline = get_pipeline()
        result = pipeline.query(
            user_query=request.query,
            mode=request.mode or "hybrid",
            generate_answer=request.generate_answer
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG execution failed: {str(e)}")


@app.post("/retrieve")
def retrieve_endpoint(request: QueryRequest):
    """Retrieves ranked candidate evidence chunks without calling the LLM generator."""
    try:
        pipeline = get_pipeline()
        result = pipeline.query(
            user_query=request.query,
            mode=request.mode or "hybrid",
            generate_answer=False
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
