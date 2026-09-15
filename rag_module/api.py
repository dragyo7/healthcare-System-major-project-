"""
Production FastAPI Application for Healthcare RAG Module (V2.8).
Exposes /rag/query, /rag/health, /ready, along with backward-compatible /retrieve and /chat endpoints.
Delegates all retrieval and evidence policy operations to the RAGService boundary.
"""
import sys
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, model_validator

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline
from rag_module.safety.evidence_policy import GroundingReasonCode
from rag_module.service import (
    RAGService,
    get_rag_service,
    RAGQueryRequest,
    RAGQueryResponse,
    RAGServiceHealth,
    RAGServiceError,
    InvalidQueryError,
    UnsupportedModeError,
    InvalidFilterError,
    ServiceNotReadyError
)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Healthcare Medical RAG Intelligence API",
    description="Evidence-grounded Medical Evidence Retrieval & Safety Orchestration API with multi-source hybrid retrieval, provenance validation, and deterministic evidence policy.",
    version="2.8.0"
)

# CORS Configuration for Frontend Integration (Vite, Next.js, React dev servers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)



# =====================================================================
# Exception Handlers (Clean JSON, No Leaked Stack Traces)
# =====================================================================

@app.exception_handler(InvalidQueryError)
async def invalid_query_handler(request: Request, exc: InvalidQueryError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "InvalidQuery", "message": exc.message}
    )


@app.exception_handler(UnsupportedModeError)
async def unsupported_mode_handler(request: Request, exc: UnsupportedModeError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "UnsupportedMode", "message": exc.message}
    )


@app.exception_handler(InvalidFilterError)
async def invalid_filter_handler(request: Request, exc: InvalidFilterError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "InvalidFilter", "message": exc.message}
    )


@app.exception_handler(ServiceNotReadyError)
async def service_not_ready_handler(request: Request, exc: ServiceNotReadyError):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error": "ServiceUnavailable", "message": exc.message}
    )


@app.exception_handler(RAGServiceError)
async def rag_service_error_handler(request: Request, exc: RAGServiceError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "RAGServiceError", "message": exc.message}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Sanitize validation error details to avoid leaking internal structures
    errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        msg = err.get("msg", "Invalid value")
        errors.append(f"{field}: {msg}" if field else msg)
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"error": "ValidationError", "message": "; ".join(errors)}
    )


# =====================================================================
# Legacy Compatibility Request/Response Models
# =====================================================================

class LegacyQueryRequest(BaseModel):
    query: Optional[str] = Field(None, description="Patient or clinician medical question")
    message: Optional[str] = Field(None, description="Alias for query")
    mode: Optional[str] = Field("hybrid", description="Retrieval mode: dense, bm25, hybrid, or hybrid_rerank")
    generate_answer: Optional[bool] = Field(True, description="Whether to invoke LLM for answer generation")
    top_k: Optional[int] = Field(5, ge=1, le=100, description="Top-k candidates")

    @model_validator(mode="before")
    @classmethod
    def normalize_query_and_message(cls, data: Any) -> Any:
        if isinstance(data, dict):
            q = data.get("query") or data.get("message")
            if q is not None:
                data["query"] = str(q)
                data["message"] = str(q)
        return data


class CitationItem(BaseModel):
    source_index: int
    title: str
    source_name: str
    publisher: str
    url: str
    chunk_id: str
    qtype: str
    score: float


class LegacyQueryResponse(BaseModel):
    question: str
    answer: str
    is_emergency: bool
    abstained: bool
    sources: List[CitationItem]
    retrieved_chunks_count: int
    pipeline_mode: str


# Global pipeline singleton for backward-compatible /chat
_legacy_pipeline: Optional[MedicalRAGPipeline] = None


def get_legacy_pipeline() -> MedicalRAGPipeline:
    global _legacy_pipeline
    if _legacy_pipeline is None:
        _legacy_pipeline = MedicalRAGPipeline()
    return _legacy_pipeline


# =====================================================================
# Health & Readiness Endpoints
# =====================================================================

@app.get("/rag/health", response_model=RAGServiceHealth, tags=["System"])
@app.get("/health", response_model=RAGServiceHealth, tags=["System"])
def health_check():
    """
    Returns system status, index health, and configuration metadata.
    Does not expose sensitive filesystem paths or credentials.
    """
    service = get_rag_service()
    return service.get_health()


@app.get("/rag/ready", tags=["System"])
@app.get("/ready", tags=["System"])
def readiness_check():
    """Lightweight readiness check for load balancers and orchestrators."""
    service = get_rag_service()
    if not service.is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RAG Service indexes not ready."
        )
    return {"status": "ready", "ready": True}


# =====================================================================
# Canonical V2.7 RAG Query Endpoint
# =====================================================================

@app.post("/rag/query", response_model=RAGQueryResponse, tags=["Retrieval"])
def rag_query_endpoint(request: RAGQueryRequest):
    """
    Canonical V2.7 Medical Evidence Retrieval Endpoint.
    Orchestrates dense semantic search, BM25 lexical matching, Reciprocal Rank Fusion,
    optional source/domain/section filtering, and formatted evidence assembly.
    """
    service = get_rag_service()
    return service.retrieve(request)


# =====================================================================
# Backward Compatibility Endpoints
# =====================================================================

@app.post("/retrieve", response_model=RAGQueryResponse, tags=["Compatibility"])
def retrieve_endpoint(request: RAGQueryRequest):
    """Retrieves ranked candidate evidence chunks via the RAG Service."""
    service = get_rag_service()
    return service.retrieve(request)


@app.post("/chat", response_model=LegacyQueryResponse, tags=["Compatibility"])
def chat_endpoint(request: LegacyQueryRequest):
    """
    Processes medical queries through the full generation pipeline (triage, retrieval, grounding policy, generation).
    Guarantees parity with /rag/query and fails closed on unverified/unsupported entities.
    """
    try:
        service = get_rag_service()
        top_k = request.top_k or 5
        rag_resp = service.retrieve(RAGQueryRequest(
            query=request.query,
            mode=request.mode or "hybrid",
            top_k=top_k
        ))

        # Check emergency triage first
        if rag_resp.safety_assessment and rag_resp.safety_assessment.is_emergency:
            return {
                "question": request.query,
                "answer": rag_resp.safety_assessment.emergency_message or "Acute emergency detected.",
                "is_emergency": True,
                "abstained": False,
                "sources": [],
                "retrieved_chunks_count": 0,
                "pipeline_mode": "emergency_triage"
            }

        # Check evidence grounding decision
        if not rag_resp.grounding or not rag_resp.grounding.generation_allowed or not rag_resp.grounding.accepted_chunk_ids:
            abstention_text = "I am not able to find sufficient verified medical evidence to answer this question."
            if rag_resp.grounding and GroundingReasonCode.UNSUPPORTED_ENTITY in rag_resp.grounding.reason_codes:
                abstention_text = "I am not able to find verified medical evidence regarding the requested subject in authoritative clinical guidelines."
            elif rag_resp.grounding and GroundingReasonCode.OUT_OF_DOMAIN in rag_resp.grounding.reason_codes:
                abstention_text = "This query appears to be outside the supported medical domain. I cannot provide guidance."

            disclaimer = "\n\n*Clinical Disclaimer: This healthcare AI assistant is an educational Major Project prototype and does not provide formal medical diagnoses, prescriptive orders, or emergency clinical advice. For health concerns or medication changes, always consult a licensed physician or healthcare professional.*"
            return {
                "question": request.query,
                "answer": abstention_text + disclaimer,
                "is_emergency": False,
                "abstained": True,
                "sources": [],
                "retrieved_chunks_count": rag_resp.total_evidence,
                "pipeline_mode": request.mode or "hybrid"
            }

        # Format citations from accepted evidence items
        citations = []
        for idx, item in enumerate(rag_resp.evidence, start=1):
            if item.chunk_id in rag_resp.grounding.accepted_chunk_ids:
                citations.append({
                    "source_index": idx,
                    "title": item.title,
                    "source_name": item.source_name,
                    "publisher": item.publisher,
                    "url": item.source_url,
                    "chunk_id": item.chunk_id,
                    "qtype": item.section,
                    "score": item.score
                })

        # Generate answer if requested
        if request.generate_answer:
            pipeline = get_legacy_pipeline()
            raw_answer = pipeline.generator.generate(request.query, rag_resp.context_text)
            final_answer = pipeline.guardrails.append_disclaimer(raw_answer)
        else:
            final_answer = "Context retrieved successfully."

        return {
            "question": request.query,
            "answer": final_answer,
            "is_emergency": False,
            "abstained": False,
            "sources": citations,
            "retrieved_chunks_count": len(citations),
            "pipeline_mode": request.mode or "hybrid"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG execution failed: {str(e)}")


# =====================================================================
# Development Diagnostic Trace Endpoint (Deliverable 15)
# =====================================================================

class DiagnosticTraceRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Clinical query to trace.")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Number of candidate chunks to evaluate.")


@app.post("/debug/rag/trace", tags=["Diagnostics"])
@app.post("/rag/trace", tags=["Diagnostics"])
def rag_trace_endpoint(request: DiagnosticTraceRequest):
    """
    Development-only forensic diagnostic endpoint.
    Exposes structured intermediate signals across every pipeline stage:
    Query -> Safety -> Embedder -> Dense -> BM25 -> RRF -> Reranker -> Policy -> Context -> LLM -> Citations.
    """
    service = get_rag_service()
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="RAG Service indexes not ready.")

    query = request.query.strip()
    top_k = request.top_k or 5

    # 1. Safety assessment
    safety_assessment = service.query_safety.assess_query(query)
    sanitized_query = safety_assessment.sanitized_query or query

    # 2. Embedding metrics
    query_vec = service.dense_retriever.embedder.encode_query(sanitized_query)
    norm_val = float(np.linalg.norm(query_vec[0]))
    embedding_info = {
        "model": service.config.EMBEDDING_MODEL_NAME,
        "dimension": service.config.EMBEDDING_DIMENSION,
        "normalized": service.config.NORMALIZE_EMBEDDINGS,
        "l2_norm": round(norm_val, 4)
    }

    # 3. Dense search
    dense_hits = service.dense_retriever.search(sanitized_query, top_k=top_k)
    dense_results = [
        {
            "rank": r,
            "chunk_id": service.dense_retriever.metadata[idx].get("chunk_id"),
            "document_id": service.dense_retriever.metadata[idx].get("document_id") or service.dense_retriever.metadata[idx].get("doc_id"),
            "title": service.dense_retriever.metadata[idx].get("title"),
            "section": service.dense_retriever.metadata[idx].get("section"),
            "source_id": service.dense_retriever.metadata[idx].get("source_id"),
            "dense_score": round(float(score), 4)
        }
        for r, (idx, score) in enumerate(dense_hits, start=1)
    ]

    # 4. BM25 search
    bm25_hits = service.bm25_retriever.search(sanitized_query, top_k=top_k)
    bm25_results = [
        {
            "rank": r,
            "chunk_id": service.bm25_retriever.metadata[idx].get("chunk_id"),
            "document_id": service.bm25_retriever.metadata[idx].get("document_id") or service.bm25_retriever.metadata[idx].get("doc_id"),
            "title": service.bm25_retriever.metadata[idx].get("title"),
            "section": service.bm25_retriever.metadata[idx].get("section"),
            "source_id": service.bm25_retriever.metadata[idx].get("source_id"),
            "bm25_score": round(float(score), 4)
        }
        for r, (idx, score) in enumerate(bm25_hits, start=1)
    ]

    # 5. Hybrid RRF
    hybrid_chunks = service.hybrid_retriever.search(
        sanitized_query,
        dense_k=max(service.config.DENSE_CANDIDATE_K, top_k),
        bm25_k=max(service.config.BM25_CANDIDATE_K, top_k),
        final_k=top_k
    )
    rrf_results = [
        {
            "rank": r,
            "chunk_id": c.get("chunk_id"),
            "fused_score": c.get("fused_score"),
            "dense_rank": c.get("dense_rank"),
            "bm25_rank": c.get("bm25_rank"),
            "source_id": c.get("source_id")
        }
        for r, c in enumerate(hybrid_chunks, start=1)
    ]

    # 6. Reranking
    if service.reranker and getattr(service.reranker, "use_reranker", False):
        reranked_chunks = service.reranker.rerank(sanitized_query, hybrid_chunks, top_k=top_k)
        reranked_results = [
            {
                "rank": r,
                "chunk_id": c.get("chunk_id"),
                "rerank_score": round(float(c.get("rerank_score", 0.0)), 4),
                "section": c.get("section")
            }
            for r, c in enumerate(reranked_chunks, start=1)
        ]
    else:
        reranked_chunks = hybrid_chunks
        reranked_results = []

    # 7. Standard Service Retrieval & Policy
    rag_resp = service.retrieve(RAGQueryRequest(query=query, mode="hybrid_rerank", top_k=top_k))

    # 8. Generation if allowed
    if rag_resp.grounding and rag_resp.grounding.generation_allowed and rag_resp.context_text:
        pipeline = get_legacy_pipeline()
        chat_res = pipeline.query(user_query=query, mode="hybrid_rerank", generate_answer=True)
        final_answer = chat_res.get("answer", "")
        citations = chat_res.get("sources", [])
    else:
        if safety_assessment.is_emergency:
            final_answer = safety_assessment.emergency_message or "Emergency triage active."
        else:
            final_answer = "I am not able to find sufficient verified medical evidence to answer this question."
        citations = []

    return {
        "query": query,
        "safety": {
            "is_emergency": safety_assessment.is_emergency,
            "risk_category": safety_assessment.risk_category.value if hasattr(safety_assessment.risk_category, "value") else str(safety_assessment.risk_category),
            "emergency_protocol": safety_assessment.emergency_message
        },
        "embedding": embedding_info,
        "dense_results": dense_results,
        "bm25_results": bm25_results,
        "rrf_results": rrf_results,
        "reranked_results": reranked_results,
        "provenance": {
            "total_candidates": len(rag_resp.evidence),
            "provenance_valid": rag_resp.grounding.provenance_valid if rag_resp.grounding else False,
            "verified_sources": rag_resp.grounding.evidence_sources if rag_resp.grounding else []
        },
        "grounding": {
            "status": rag_resp.grounding.status.value if rag_resp.grounding else "unknown",
            "generation_allowed": rag_resp.grounding.generation_allowed if rag_resp.grounding else False,
            "accepted_chunk_ids": rag_resp.grounding.accepted_chunk_ids if rag_resp.grounding else [],
            "reason_codes": [r.value if hasattr(r, "value") else str(r) for r in rag_resp.grounding.reason_codes] if rag_resp.grounding else [],
            "warnings": rag_resp.grounding.warnings if rag_resp.grounding else []
        },
        "context_text_sample": rag_resp.context_text[:300] if rag_resp.context_text else "",
        "final_answer": final_answer,
        "citations": citations
    }


if __name__ == "__main__":
    import uvicorn
    import numpy as np
    uvicorn.run(app, host="0.0.0.0", port=8000)
