"""
RAG Service Layer (V2.8 — Grounding, Evidence Policy & Safety Foundation).
Provides a clean, modular, production-grade service boundary for medical evidence retrieval,
structured request validation, provenance tracking, evidence policy enforcement, and error handling.
"""
import time
import re
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

from rag_module.config.rag_config import DEFAULT_CONFIG, RAGConfig
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.reranking.cross_encoder_reranker import CrossEncoderReranker
from rag_module.context.context_builder import ContextBuilder
from rag_module.safety.provenance_validator import ProvenanceValidator, ProvenanceStatus, ProvenanceValidationResult
from rag_module.safety.query_safety import QuerySafetyEngine, QuerySafetyAssessment, QueryRiskCategory
from rag_module.safety.evidence_policy import (
    EvidencePolicyEngine,
    EvidencePolicyConfig,
    GroundingDecision,
    GroundingStatus,
    GroundingReasonCode,
    SourcePolicy
)


# =====================================================================
# Error Hierarchy
# =====================================================================

class RAGServiceError(Exception):
    """Base exception for all RAG service errors."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InvalidQueryError(RAGServiceError):
    """Raised when query is empty, whitespace-only, or violates length constraints."""
    def __init__(self, message: str = "Query must be a non-empty string with valid characters."):
        super().__init__(message, status_code=400)


class UnsupportedModeError(RAGServiceError):
    """Raised when an unrecognized retrieval mode is requested."""
    def __init__(self, mode: str):
        super().__init__(
            f"Unsupported retrieval mode '{mode}'. Supported modes: 'dense', 'bm25', 'hybrid', 'hybrid_rerank'.",
            status_code=400
        )


class InvalidFilterError(RAGServiceError):
    """Raised when a filter list contains invalid or malformed values."""
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class ServiceNotReadyError(RAGServiceError):
    """Raised when the RAG service or its indexes are not initialized."""
    def __init__(self, message: str = "RAG retrieval indexes are not initialized or ready."):
        super().__init__(message, status_code=503)


# =====================================================================
# Data & Request/Response Models
# =====================================================================

class RetrievalMode(str, Enum):
    DENSE = "dense"
    BM25 = "bm25"
    HYBRID = "hybrid"
    HYBRID_RERANK = "hybrid_rerank"


class RAGQueryRequest(BaseModel):
    """
    Validated request contract for the RAG retrieval service.
    """
    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Clinical query or patient question."
    )
    mode: RetrievalMode = Field(
        default=RetrievalMode.HYBRID,
        description="Retrieval mode: 'dense', 'bm25', 'hybrid', or 'hybrid_rerank'."
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=100,
        description="Number of candidate evidence chunks to return (1-100)."
    )
    source_filter: Optional[List[str]] = Field(
        default=None,
        description="Optional filter by source_id (e.g. ['DailyMed', 'medquad_nih'])."
    )
    domain_filter: Optional[List[str]] = Field(
        default=None,
        description="Optional filter by medical domain (e.g. ['pharmacology', 'general_medicine'])."
    )
    section_filter: Optional[List[str]] = Field(
        default=None,
        description="Optional filter by clinical section name (e.g. ['indications & usage', 'dosage & administration'])."
    )

    @field_validator("query")
    @classmethod
    def validate_non_empty_query(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Query cannot be empty or whitespace-only.")
        return cleaned

    @field_validator("source_filter", "domain_filter", "section_filter")
    @classmethod
    def validate_filter_items(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return None
        cleaned = [item.strip() for item in v if item and item.strip()]
        if not cleaned:
            return None
        return cleaned

    model_config = ConfigDict(extra="forbid")


class EvidenceItem(BaseModel):
    """
    Structured, decoupled evidence representation with complete clinical provenance.
    Contains no raw FAISS or BM25 index handles.
    """
    rank: int = Field(..., ge=1, description="1-based rank in the final returned evidence list.")
    score: float = Field(..., description="Primary retrieval or fusion score.")
    source_id: str = Field(..., description="Unique source identifier (e.g. 'DailyMed', 'medquad_nih').")
    source_name: str = Field(..., description="Human-readable source name.")
    publisher: str = Field(..., description="Publishing body or organization.")
    document_id: str = Field(..., description="Canonical document ID from the knowledge pipeline.")
    chunk_id: str = Field(..., description="Unique chunk ID.")
    title: str = Field(..., description="Document or section title.")
    section: str = Field(..., description="Clinical section name or question type.")
    medical_domain: str = Field(..., description="Medical specialty or domain.")
    source_url: str = Field(default="", description="Original source or regulatory URL.")
    text: str = Field(..., description="Clinical evidence text content.")
    dense_score: Optional[float] = Field(default=None, description="Cosine similarity score from dense vector retrieval.")
    bm25_score: Optional[float] = Field(default=None, description="BM25Okapi lexical score.")
    fused_score: Optional[float] = Field(default=None, description="Reciprocal Rank Fusion score (hybrid).")
    rerank_score: Optional[float] = Field(default=None, description="Cross-encoder relevance score.")

    model_config = ConfigDict(extra="forbid")


class RAGQueryResponse(BaseModel):
    """
    Structured response contract returned by the RAG retrieval service (V2.8).
    Exposes auditable evidence, formatted context, and explicit grounding decisions.
    """
    query: str = Field(..., description="The sanitized query that was processed.")
    retrieval_mode: str = Field(..., description="The retrieval mode executed ('dense', 'bm25', 'hybrid', 'hybrid_rerank').")
    total_evidence: int = Field(..., ge=0, description="Total number of evidence items returned.")
    evidence: List[EvidenceItem] = Field(..., description="Ranked list of structured clinical evidence items.")
    context_text: str = Field(..., description="Formatted XML-delimited context ready for generation or downstream use.")
    latency_ms: float = Field(..., ge=0.0, description="End-to-end retrieval and policy latency in milliseconds.")
    reranker_status: str = Field(..., description="Status of the reranker stage ('available', 'fallback_pass_through', 'disabled').")
    filters_applied: Dict[str, Any] = Field(default_factory=dict, description="Summary of active filters applied.")
    grounding: Optional[GroundingDecision] = Field(default=None, description="Deterministic evidence policy and grounding decision.")
    safety_assessment: Optional[QuerySafetyAssessment] = Field(default=None, description="Pre-retrieval query risk evaluation.")

    model_config = ConfigDict(extra="forbid")


class RAGServiceHealth(BaseModel):
    """
    Health and readiness status of the RAG service.
    Exposes no sensitive filesystem paths or credentials.
    """
    status: str = Field(..., description="Overall service status ('healthy', 'degraded', 'unready').")
    version: str = Field(default="2.8.0", description="RAG Service version.")
    service_ready: bool = Field(..., description="Whether the service is ready to accept retrieval requests.")
    index_ready: bool = Field(..., description="Whether underlying vector and lexical indexes are loaded.")
    indexed_chunks_count: int = Field(..., ge=0, description="Total number of indexed chunks available.")
    embedding_model: str = Field(..., description="Active embedding model identifier.")
    dense_ready: bool = Field(..., description="Whether dense FAISS retriever is ready.")
    bm25_ready: bool = Field(..., description="Whether BM25 retriever is ready.")
    hybrid_ready: bool = Field(..., description="Whether hybrid retriever is ready.")
    reranker_status: str = Field(..., description="Reranker operational status.")

    model_config = ConfigDict(extra="forbid")


# =====================================================================
# Service Implementation
# =====================================================================

class RAGService:
    """
    Modular RAG Retrieval & Safety Orchestration Service.
    Encapsulates retrieval orchestration, filtering, context formatting,
    provenance validation, evidence policy enforcement, and performance tracking.
    """
    def __init__(
        self,
        config: Optional[RAGConfig] = None,
        dense_retriever: Optional[DenseRetriever] = None,
        bm25_retriever: Optional[BM25Retriever] = None,
        hybrid_retriever: Optional[HybridRetriever] = None,
        reranker: Optional[CrossEncoderReranker] = None,
        context_builder: Optional[ContextBuilder] = None,
        query_safety: Optional[QuerySafetyEngine] = None,
        evidence_policy: Optional[EvidencePolicyEngine] = None
    ):
        self.config = config or DEFAULT_CONFIG

        # 1. Dense Retriever
        self.dense_retriever = dense_retriever
        if self.dense_retriever is None and self.config.FAISS_INDEX_PATH.exists():
            try:
                self.dense_retriever = DenseRetriever(config=self.config)
            except Exception:
                self.dense_retriever = None

        # 2. BM25 Retriever
        self.bm25_retriever = bm25_retriever
        if self.bm25_retriever is None and self.config.BM25_INDEX_PATH.exists():
            try:
                self.bm25_retriever = BM25Retriever.load(self.config.BM25_INDEX_PATH)
            except Exception:
                self.bm25_retriever = None
        elif self.bm25_retriever is None and self.dense_retriever is not None:
            try:
                self.bm25_retriever = BM25Retriever()
                self.bm25_retriever.fit(self.dense_retriever.metadata)
            except Exception:
                self.bm25_retriever = None

        # 3. Hybrid Retriever
        self.hybrid_retriever = hybrid_retriever
        if self.hybrid_retriever is None and self.dense_retriever is not None and self.bm25_retriever is not None:
            try:
                self.hybrid_retriever = HybridRetriever(
                    dense_retriever=self.dense_retriever,
                    bm25_retriever=self.bm25_retriever,
                    config=self.config
                )
            except Exception:
                self.hybrid_retriever = None

        # 4. Reranker
        self.reranker = reranker or CrossEncoderReranker(
            model_name=self.config.RERANKER_MODEL_NAME,
            use_reranker=self.config.USE_RERANKER
        )

        # 5. Context Builder
        self.context_builder = context_builder or ContextBuilder(
            max_context_tokens=self.config.MAX_CONTEXT_TOKENS,
            max_chunks=self.config.FINAL_TOP_K
        )

        # 6. Safety & Evidence Policy Engines (V2.8)
        self.query_safety = query_safety or QuerySafetyEngine(
            enable_emergency=self.config.ENABLE_EMERGENCY_TRIAGE,
            enable_sanitization=True
        )
        self.evidence_policy = evidence_policy or EvidencePolicyEngine()

    def is_ready(self) -> bool:
        """Checks if at least one retriever index is operational."""
        return self.dense_retriever is not None or self.bm25_retriever is not None

    def get_health(self) -> RAGServiceHealth:
        """Constructs a structured health report without leaking filesystem paths."""
        dense_ready = self.dense_retriever is not None and getattr(self.dense_retriever, "index", None) is not None
        bm25_ready = self.bm25_retriever is not None and getattr(self.bm25_retriever, "corpus_size", 0) > 0
        hybrid_ready = self.hybrid_retriever is not None and dense_ready and bm25_ready

        chunks_count = 0
        if dense_ready:
            chunks_count = len(self.dense_retriever.metadata)
        elif bm25_ready:
            chunks_count = self.bm25_retriever.corpus_size

        service_ready = dense_ready or bm25_ready
        status = "healthy" if (dense_ready and bm25_ready) else ("degraded" if service_ready else "unready")

        reranker_status = "fallback_pass_through"
        if self.reranker and getattr(self.reranker, "use_reranker", False):
            if getattr(self.reranker, "_model", None) is not None:
                reranker_status = "available"
            else:
                reranker_status = "fallback_pass_through"
        else:
            reranker_status = "disabled"

        return RAGServiceHealth(
            status=status,
            version="2.8.0",
            service_ready=service_ready,
            index_ready=service_ready,
            indexed_chunks_count=chunks_count,
            embedding_model=self.config.EMBEDDING_MODEL_NAME,
            dense_ready=dense_ready,
            bm25_ready=bm25_ready,
            hybrid_ready=hybrid_ready,
            reranker_status=reranker_status
        )

    def retrieve(self, request: RAGQueryRequest) -> RAGQueryResponse:
        """
        Executes evidence retrieval and applies evidence policy for a validated RAGQueryRequest.
        Returns a structured RAGQueryResponse with an auditable GroundingDecision.
        """
        if not self.is_ready():
            raise ServiceNotReadyError("RAG service is not initialized or index files are missing.")

        start_time = time.perf_counter()
        raw_query = request.query.strip()
        mode = request.mode.value if isinstance(request.mode, RetrievalMode) else str(request.mode).lower()
        top_k = request.top_k

        # Validate mode availability
        if mode not in ["dense", "bm25", "hybrid", "hybrid_rerank"]:
            raise UnsupportedModeError(mode)

        if mode == "dense" and not self.dense_retriever:
            raise ServiceNotReadyError("Dense retriever is not available.")
        if mode == "bm25" and not self.bm25_retriever:
            raise ServiceNotReadyError("BM25 retriever is not available.")
        if mode in ["hybrid", "hybrid_rerank"] and not self.hybrid_retriever:
            if not self.dense_retriever and not self.bm25_retriever:
                raise ServiceNotReadyError("Neither hybrid nor fallback retrievers are available.")

        # Step 0: Pre-retrieval Query Safety Screening
        safety_assessment = self.query_safety.assess_query(raw_query)
        sanitized_query = safety_assessment.sanitized_query or raw_query

        # If acute medical emergency detected, return emergency response immediately
        if safety_assessment.is_emergency:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            emergency_grounding = GroundingDecision(
                status=GroundingStatus.INSUFFICIENT_EVIDENCE,
                generation_allowed=False,
                evidence_count=0,
                usable_evidence_count=0,
                provenance_valid=False,
                top_evidence_rank=None,
                evidence_sources=[],
                evidence_documents=[],
                evidence_sections=[],
                reason_codes=[GroundingReasonCode.NO_EVIDENCE],
                warnings=["Query intercepted by acute emergency triage guardrail."],
                conflict_detected=False,
                conflict_summary=None,
                policy_latency_ms=0.0
            )
            return RAGQueryResponse(
                query=raw_query,
                retrieval_mode=mode,
                total_evidence=0,
                evidence=[],
                context_text=safety_assessment.emergency_message or "Acute emergency detected.",
                latency_ms=round(elapsed_ms, 2),
                reranker_status="disabled",
                filters_applied={},
                grounding=emergency_grounding,
                safety_assessment=safety_assessment
            )

        # Step 1: Execute primary retrieval
        candidate_chunks: List[Dict[str, Any]] = []

        fetch_k = top_k
        if request.section_filter:
            fetch_k = max(top_k * 4, 50)

        if mode == "dense":
            dense_results = self.dense_retriever.search(
                sanitized_query,
                top_k=fetch_k,
                source_filter=request.source_filter,
                domain_filter=request.domain_filter
            )
            candidate_chunks = [
                dict(self.dense_retriever.metadata[idx], dense_score=score, score=score)
                for idx, score in dense_results
            ]

        elif mode == "bm25":
            bm25_results = self.bm25_retriever.search(
                sanitized_query,
                top_k=fetch_k,
                source_filter=request.source_filter,
                domain_filter=request.domain_filter
            )
            candidate_chunks = [
                dict(self.bm25_retriever.metadata[idx], bm25_score=score, score=score)
                for idx, score in bm25_results
            ]

        elif mode in ["hybrid", "hybrid_rerank"]:
            if self.hybrid_retriever:
                candidate_chunks = self.hybrid_retriever.search(
                    sanitized_query,
                    dense_k=max(self.config.DENSE_CANDIDATE_K, fetch_k),
                    bm25_k=max(self.config.BM25_CANDIDATE_K, fetch_k),
                    final_k=fetch_k,
                    source_filter=request.source_filter,
                    domain_filter=request.domain_filter
                )
                for chunk in candidate_chunks:
                    chunk["score"] = chunk.get("fused_score", chunk.get("dense_score", 0.0))
            elif self.dense_retriever:
                dense_results = self.dense_retriever.search(
                    sanitized_query,
                    top_k=fetch_k,
                    source_filter=request.source_filter,
                    domain_filter=request.domain_filter
                )
                candidate_chunks = [
                    dict(self.dense_retriever.metadata[idx], dense_score=score, score=score)
                    for idx, score in dense_results
                ]
            elif self.bm25_retriever:
                bm25_results = self.bm25_retriever.search(
                    sanitized_query,
                    top_k=fetch_k,
                    source_filter=request.source_filter,
                    domain_filter=request.domain_filter
                )
                candidate_chunks = [
                    dict(self.bm25_retriever.metadata[idx], bm25_score=score, score=score)
                    for idx, score in bm25_results
                ]

        # Step 2: Apply optional section filtering
        if request.section_filter and candidate_chunks:
            section_set = {s.lower() for s in request.section_filter}
            filtered_chunks = []
            for chunk in candidate_chunks:
                chunk_section = str(chunk.get("section") or chunk.get("qtype") or "").lower()
                if any(sec in chunk_section or chunk_section in sec for sec in section_set):
                    filtered_chunks.append(chunk)
            candidate_chunks = filtered_chunks

        # Step 3: Reranker stage (if requested)
        reranker_status = "disabled"
        if mode in ["hybrid_rerank", "hybrid"] and self.reranker:
            if getattr(self.reranker, "use_reranker", False):
                # Let the reranker handle lazy-loading internally via _get_model()
                candidate_chunks = self.reranker.rerank(sanitized_query, candidate_chunks, top_k=top_k)
                # Check post-call status: did the model actually load?
                if getattr(self.reranker, "_model", None) is not None:
                    reranker_status = "available"
                else:
                    reranker_status = "fallback_pass_through"
            else:
                reranker_status = "disabled"
                candidate_chunks = candidate_chunks[:top_k]
        else:
            candidate_chunks = candidate_chunks[:top_k]

        # Step 4: Construct structured EvidenceItem models
        evidence_items: List[EvidenceItem] = []
        for rank, chunk in enumerate(candidate_chunks, start=1):
            if "rerank_score" in chunk and chunk["rerank_score"] is not None:
                score = float(chunk["rerank_score"])
            else:
                score = float(chunk.get("fused_score") or chunk.get("dense_score") or chunk.get("bm25_score") or chunk.get("score") or 0.0)

            item = EvidenceItem(
                rank=rank,
                score=round(score, 6),
                source_id=str(chunk.get("source_id") or "unknown"),
                source_name=str(chunk.get("source_name") or "Medical Knowledge Base"),
                publisher=str(chunk.get("publisher") or "Unknown Publisher"),
                document_id=str(chunk.get("document_id") or chunk.get("doc_id") or f"doc_{rank}"),
                chunk_id=str(chunk.get("chunk_id") or f"chunk_{rank}"),
                title=str(chunk.get("title") or chunk.get("focus") or "Medical Reference"),
                section=str(chunk.get("section") or chunk.get("qtype") or "General"),
                medical_domain=str(chunk.get("medical_domain") or "general_medicine"),
                source_url=str(chunk.get("source_url") or chunk.get("url") or ""),
                text=str(chunk.get("text") or "").strip(),
                dense_score=round(float(chunk["dense_score"]), 4) if "dense_score" in chunk and chunk["dense_score"] is not None else None,
                bm25_score=round(float(chunk["bm25_score"]), 4) if "bm25_score" in chunk and chunk["bm25_score"] is not None else None,
                fused_score=round(float(chunk["fused_score"]), 6) if "fused_score" in chunk and chunk["fused_score"] is not None else None,
                rerank_score=round(float(chunk["rerank_score"]), 4) if "rerank_score" in chunk and chunk["rerank_score"] is not None else None
            )
            evidence_items.append(item)

        # Step 5: Evidence Policy & Grounding Evaluation (V2.8)
        grounding_decision = self.evidence_policy.evaluate_evidence(
            query=sanitized_query,
            evidence_items=evidence_items,
            retrieval_mode=mode
        )

        # Step 6: Format context string via ContextBuilder (strictly bounded to accepted chunks if generation allowed)
        if grounding_decision.generation_allowed and grounding_decision.accepted_chunk_ids:
            accepted_set = set(grounding_decision.accepted_chunk_ids)
            accepted_chunks = [c for c in candidate_chunks if (c.get("chunk_id") or c.get("id")) in accepted_set]
            # Fallback to candidate_chunks[:usable_evidence_count] only if chunk_ids were not present in dicts
            if not accepted_chunks and candidate_chunks:
                accepted_chunks = candidate_chunks[:grounding_decision.usable_evidence_count]
            context_str, _ = self.context_builder.build_context(accepted_chunks)
        else:
            context_str = ""

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        filters_summary = {}
        if request.source_filter:
            filters_summary["source_filter"] = request.source_filter
        if request.domain_filter:
            filters_summary["domain_filter"] = request.domain_filter
        if request.section_filter:
            filters_summary["section_filter"] = request.section_filter

        return RAGQueryResponse(
            query=sanitized_query,
            retrieval_mode=mode,
            total_evidence=len(evidence_items),
            evidence=evidence_items,
            context_text=context_str,
            latency_ms=round(elapsed_ms, 2),
            reranker_status=reranker_status,
            filters_applied=filters_summary,
            grounding=grounding_decision,
            safety_assessment=safety_assessment
        )


# Global singleton instance holder
_rag_service: Optional[RAGService] = None


def get_rag_service(config: Optional[RAGConfig] = None) -> RAGService:
    """Returns or initializes the singleton RAGService instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService(config=config)
    return _rag_service
