"""
RAG Pipeline Orchestrator (V2).
Connects Safety Guardrails, Hybrid Retrieval (FAISS + BM25), Cross-Encoder Reranking,
Context Construction, Citation Attribution, and LLM Generation.
"""
from typing import Dict, Any, Optional, List
from pathlib import Path

from rag_module.config.rag_config import DEFAULT_CONFIG, RAGConfig
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.reranking.cross_encoder_reranker import CrossEncoderReranker
from rag_module.context.context_builder import ContextBuilder
from rag_module.safety.guardrails import SafetyGuardrails
from rag_module.generation.generator_v2 import MedicalGenerator


class MedicalRAGPipeline:
    """
    Production-grade Healthcare RAG Pipeline Orchestrator.
    """
    def __init__(
        self,
        config: Optional[RAGConfig] = None,
        dense_retriever: Optional[DenseRetriever] = None,
        bm25_retriever: Optional[BM25Retriever] = None,
        reranker: Optional[CrossEncoderReranker] = None,
        generator: Optional[MedicalGenerator] = None
    ):
        self.config = config or DEFAULT_CONFIG
        
        # 1. Initialize Safety Layer
        self.guardrails = SafetyGuardrails(self.config)
        
        # 2. Initialize Retrievers
        self.dense_retriever = dense_retriever
        self.bm25_retriever = bm25_retriever
        
        # Lazy load retrievers if not provided
        if self.dense_retriever is None and self.config.FAISS_INDEX_PATH.exists():
            self.dense_retriever = DenseRetriever(config=self.config)
            
        if self.bm25_retriever is None and self.config.BM25_INDEX_PATH.exists():
            self.bm25_retriever = BM25Retriever.load(self.config.BM25_INDEX_PATH)
        elif self.bm25_retriever is None and self.dense_retriever is not None:
            # Build in-memory BM25 from metadata
            self.bm25_retriever = BM25Retriever()
            self.bm25_retriever.fit(self.dense_retriever.metadata)

        # 3. Hybrid Retriever
        if self.dense_retriever is not None and self.bm25_retriever is not None:
            self.hybrid_retriever = HybridRetriever(
                dense_retriever=self.dense_retriever,
                bm25_retriever=self.bm25_retriever,
                config=self.config
            )
        else:
            self.hybrid_retriever = None

        # 4. Reranker
        self.reranker = reranker or CrossEncoderReranker(
            model_name=self.config.RERANKER_MODEL_NAME,
            use_reranker=self.config.USE_RERANKER
        )

        # 5. Context Builder
        self.context_builder = ContextBuilder(
            max_context_tokens=self.config.MAX_CONTEXT_TOKENS,
            max_chunks=self.config.FINAL_TOP_K
        )

        # 6. Generator
        self.generator = generator or MedicalGenerator.get_instance()

    def query(
        self,
        user_query: str,
        mode: str = "hybrid",  # "dense", "bm25", "hybrid", "hybrid_rerank"
        generate_answer: bool = True
    ) -> Dict[str, Any]:
        """
        Executes end-to-end RAG query processing.
        Returns:
            dict containing: {
                "question": str,
                "answer": str,
                "is_emergency": bool,
                "abstained": bool,
                "sources": List[dict],
                "retrieved_chunks_count": int,
                "pipeline_mode": str
            }
        """
        # Step 1: Emergency Triage Check
        emergency_alert = self.guardrails.check_emergency(user_query)
        if emergency_alert:
            return {
                "question": user_query,
                "answer": emergency_alert,
                "is_emergency": True,
                "abstained": False,
                "sources": [],
                "retrieved_chunks_count": 0,
                "pipeline_mode": "emergency_triage"
            }

        # Step 2: Input Sanitization
        sanitized_query = self.guardrails.sanitize_input(user_query)
        if not sanitized_query:
            return {
                "question": user_query,
                "answer": "Query cannot be empty or invalid.",
                "is_emergency": False,
                "abstained": True,
                "sources": [],
                "retrieved_chunks_count": 0,
                "pipeline_mode": "validation_error"
            }

        # Step 3: Retrieval Stage
        candidate_chunks = []
        if mode == "dense" and self.dense_retriever:
            dense_results = self.dense_retriever.search(sanitized_query, top_k=self.config.DENSE_CANDIDATE_K)
            candidate_chunks = [dict(self.dense_retriever.metadata[idx], dense_score=score) for idx, score in dense_results]
        elif mode == "bm25" and self.bm25_retriever:
            bm25_results = self.bm25_retriever.search(sanitized_query, top_k=self.config.BM25_CANDIDATE_K)
            candidate_chunks = [dict(self.bm25_retriever.metadata[idx], bm25_score=score) for idx, score in bm25_results]
        elif self.hybrid_retriever:
            candidate_chunks = self.hybrid_retriever.search(
                sanitized_query,
                dense_k=self.config.DENSE_CANDIDATE_K,
                bm25_k=self.config.BM25_CANDIDATE_K,
                final_k=max(self.config.DENSE_CANDIDATE_K, self.config.FINAL_TOP_K)
            )
        elif self.dense_retriever:
            dense_results = self.dense_retriever.search(sanitized_query, top_k=self.config.FINAL_TOP_K)
            candidate_chunks = [dict(self.dense_retriever.metadata[idx], dense_score=score) for idx, score in dense_results]

        # Step 4: Second-Stage Reranking (if enabled/requested)
        if mode in ["hybrid_rerank", "hybrid"] and self.reranker and candidate_chunks:
            final_chunks = self.reranker.rerank(
                sanitized_query,
                candidate_chunks,
                top_k=self.config.FINAL_TOP_K
            )
        else:
            final_chunks = candidate_chunks[:self.config.FINAL_TOP_K]

        # Step 5: Abstention Gate
        should_abstain, abstention_msg = self.guardrails.check_abstention(final_chunks)
        if should_abstain:
            return {
                "question": sanitized_query,
                "answer": self.guardrails.append_disclaimer(abstention_msg),
                "is_emergency": False,
                "abstained": True,
                "sources": [],
                "retrieved_chunks_count": len(final_chunks),
                "pipeline_mode": mode
            }

        # Step 6: Context & Citation Construction
        context_str, citations = self.context_builder.build_context(final_chunks)

        # Step 7: Generation
        if generate_answer:
            raw_answer = self.generator.generate(sanitized_query, context_str)
            final_answer = self.guardrails.append_disclaimer(raw_answer)
        else:
            final_answer = "Context retrieved successfully."

        return {
            "question": sanitized_query,
            "answer": final_answer,
            "is_emergency": False,
            "abstained": False,
            "sources": citations,
            "retrieved_chunks_count": len(final_chunks),
            "pipeline_mode": mode
        }
