"""
Production FastAPI Application for Healthcare RAG Module (V2.8).
Exposes /rag/query, /rag/health, /ready, along with backward-compatible /retrieve and /chat endpoints.
Delegates all retrieval and evidence policy operations to the RAGService boundary.
"""
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline
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

app = FastAPI(
    title="Healthcare Medical RAG Intelligence API",
    description="Evidence-grounded Medical Evidence Retrieval & Safety Orchestration API with multi-source hybrid retrieval, provenance validation, and deterministic evidence policy.",
    version="2.8.0"
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
    query: str = Field(..., min_length=1, description="Patient or clinician medical question")
    mode: Optional[str] = Field("hybrid", description="Retrieval mode: dense, bm25, hybrid, or hybrid_rerank")
    generate_answer: Optional[bool] = Field(True, description="Whether to invoke LLM for answer generation")
    top_k: Optional[int] = Field(5, ge=1, le=100, description="Top-k candidates")


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
    Processes medical queries through the full generation pipeline (triage, retrieval, generation).
    Preserved for backward compatibility.
    """
    try:
        pipeline = get_legacy_pipeline()
        result = pipeline.query(
            user_query=request.query,
            mode=request.mode or "hybrid",
            generate_answer=request.generate_answer if request.generate_answer is not None else True
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG execution failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
