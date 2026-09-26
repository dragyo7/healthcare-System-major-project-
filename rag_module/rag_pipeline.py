"""
RAG Pipeline Orchestrator (V2).
Connects Safety Guardrails, Hybrid Retrieval (FAISS + BM25), Cross-Encoder Reranking,
Context Construction, Citation Attribution, and LLM Generation.
"""
from typing import Dict, Any, Optional, List, Set
from pathlib import Path

from rag_module.config.rag_config import DEFAULT_CONFIG, RAGConfig
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.retrieval.query_analyzer import QueryAnalyzer, QueryAnalysis, RetrievalBudget, ClinicalIntent
from rag_module.reranking.cross_encoder_reranker import CrossEncoderReranker
from rag_module.context.context_builder import ContextBuilder
from rag_module.safety.guardrails import SafetyGuardrails
from rag_module.safety.evidence_policy import EvidencePolicyEngine, GroundingReasonCode
from rag_module.safety.grounding_verifier import AnswerGroundingVerifier, ClaimStatus
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
        generator: Optional[MedicalGenerator] = None,
        evidence_policy: Optional[EvidencePolicyEngine] = None,
        verifier: Optional[AnswerGroundingVerifier] = None,
        query_analyzer: Optional[QueryAnalyzer] = None
    ):
        self.config = config or DEFAULT_CONFIG
        
        # 1. Initialize Safety Layer & Evidence Policy
        self.guardrails = SafetyGuardrails(self.config)
        self.evidence_policy = evidence_policy or EvidencePolicyEngine()
        self.query_analyzer = query_analyzer or QueryAnalyzer()
        
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

        # 7. Grounding Verifier (V2.9)
        self.grounding_verifier = verifier or AnswerGroundingVerifier()

    def _select_section_diverse_chunks(
        self,
        scored_chunks: List[Dict[str, Any]],
        target_sections: List[str],
        final_k: int
    ) -> List[Dict[str, Any]]:
        """
        Selects candidate passages ensuring that multi-part clinical target sections
        (e.g., Indications, Contraindications, Adverse Reactions, Dosage) are represented
        in context without sacrificing cross-encoder relevance quality.
        """
        if not scored_chunks:
            return []

        selected: List[Dict[str, Any]] = []
        selected_ids: Set[str] = set()

        # Step 1: For each target clinical section, pick the top-scoring candidate matching that section
        for target_sec in target_sections:
            target_lower = target_sec.lower()
            for chunk in scored_chunks:
                cid = str(chunk.get("chunk_id", ""))
                sec = str(chunk.get("section", "")).lower()
                if cid not in selected_ids and (target_lower in sec or sec in target_lower):
                    selected.append(chunk)
                    selected_ids.add(cid)
                    break
            if len(selected) >= final_k:
                break

        # Step 2: Fill remaining slots with the highest-scoring candidate chunks
        for chunk in scored_chunks:
            cid = str(chunk.get("chunk_id", ""))
            if cid not in selected_ids:
                selected.append(chunk)
                selected_ids.add(cid)
            if len(selected) >= final_k:
                break

        # Step 3: Sort back descending by rerank_score (or original order)
        selected.sort(key=lambda x: x.get("rerank_score", 0.0), reverse=True)
        return selected

    def query(
        self,
        user_query: str,
        mode: str = "hybrid",  # "dense", "bm25", "hybrid", "hybrid_rerank"
        top_k: Optional[int] = None,
        generate_answer: bool = True,
        verify_answer: bool = True,
        audience: Optional[str] = "doctor",
        patient_context: Optional[Dict[str, Any]] = None,
        clinician_context: Optional[Dict[str, Any]] = None
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
                "pipeline_mode": str,
                "query_analysis": dict
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

        # Step 2.5: Dynamic Query Understanding & Retrieval Budgeting
        query_analysis = self.query_analyzer.analyze(sanitized_query)
        budget = query_analysis.retrieval_budget

        dense_k = budget.dense_k
        bm25_k = budget.bm25_k
        target_final_k = top_k or budget.final_top_k

        # Step 3: Retrieval Stage
        candidate_chunks = []
        if mode == "dense" and self.dense_retriever:
            dense_results = self.dense_retriever.search(sanitized_query, top_k=dense_k)
            candidate_chunks = [dict(self.dense_retriever.metadata[idx], dense_score=score) for idx, score in dense_results]
        elif mode == "bm25" and self.bm25_retriever:
            bm25_results = self.bm25_retriever.search(sanitized_query, top_k=bm25_k)
            candidate_chunks = [dict(self.bm25_retriever.metadata[idx], bm25_score=score) for idx, score in bm25_results]
        elif self.hybrid_retriever:
            candidate_chunks = self.hybrid_retriever.search(
                sanitized_query,
                dense_k=dense_k,
                bm25_k=bm25_k,
                final_k=max(dense_k, bm25_k, target_final_k * 3)
            )
        elif self.dense_retriever:
            dense_results = self.dense_retriever.search(sanitized_query, top_k=target_final_k)
            candidate_chunks = [dict(self.dense_retriever.metadata[idx], dense_score=score) for idx, score in dense_results]

        # Step 4: Second-Stage Reranking & Dynamic Section Selection
        if mode in ["hybrid_rerank", "hybrid"] and self.reranker and candidate_chunks:
            scored_candidates = self.reranker.rerank(
                sanitized_query,
                candidate_chunks,
                top_k=len(candidate_chunks)
            )
        else:
            scored_candidates = candidate_chunks

        # Entity-isolation screening:
        # If the query identified a single target drug/entity and is not a multi-entity comparison,
        # prioritize chunks belonging to that target entity to prevent cross-entity distractor contamination.
        if query_analysis.candidate_entities and ClinicalIntent.COMPARISON not in query_analysis.intents:
            primary_entity = query_analysis.candidate_entities[0].lower()
            entity_matching = [
                c for c in scored_candidates
                if primary_entity in str(c.get("title", "")).lower() or primary_entity in str(c.get("text", "")).lower()
            ]
            if len(entity_matching) >= 1:
                non_conflicting = [
                    c for c in scored_candidates
                    if c not in entity_matching and not any(
                        sep in str(c.get("title", "")) for sep in [" - Indications", " - Dosage", " - Contraindications", " - Adverse Reactions"]
                    )
                ]
                scored_candidates = entity_matching + non_conflicting

        # Apply section diversity if multi-part query requires distinct clinical aspects
        if budget.require_section_diversity and budget.target_sections and len(scored_candidates) > target_final_k:
            final_chunks = self._select_section_diverse_chunks(
                scored_chunks=scored_candidates,
                target_sections=budget.target_sections,
                final_k=target_final_k
            )
        else:
            final_chunks = scored_candidates[:target_final_k]

        # Step 5: Abstention Gate & Evidence Policy Evaluation
        should_abstain, abstention_msg = self.guardrails.check_abstention(final_chunks)
        grounding_decision = self.evidence_policy.evaluate_evidence(sanitized_query, final_chunks, retrieval_mode=mode)

        if should_abstain or not grounding_decision.generation_allowed:
            if not grounding_decision.generation_allowed:
                if GroundingReasonCode.UNSUPPORTED_ENTITY in grounding_decision.reason_codes:
                    msg = "I am not able to find verified medical evidence regarding the requested subject in authoritative clinical guidelines."
                elif GroundingReasonCode.OUT_OF_DOMAIN in grounding_decision.reason_codes:
                    msg = "This query appears to be outside the supported medical domain. I cannot provide guidance."
                else:
                    msg = "I am not able to find sufficient verified medical evidence to answer this question."
            else:
                msg = abstention_msg

            return {
                "question": sanitized_query,
                "answer": self.guardrails.append_disclaimer(msg),
                "is_emergency": False,
                "abstained": True,
                "sources": [],
                "retrieved_chunks_count": len(final_chunks),
                "pipeline_mode": mode,
                "query_analysis": query_analysis.model_dump()
            }

        # Filter to accepted chunks if any were rejected by policy
        accepted_chunks = [c for c in final_chunks if c.get("chunk_id") in (grounding_decision.accepted_chunk_ids or set())] or final_chunks

        # Step 6: Context & Citation Construction
        context_str, citations = self.context_builder.build_context(accepted_chunks)

        # Step 7: Generation & Post-Generation Verification
        abstained = False
        verification_result = None
        if generate_answer:
            try:
                raw_answer = self.generator.generate(sanitized_query, context_str, audience=audience)
            except TypeError:
                raw_answer = self.generator.generate(sanitized_query, context_str)
            if verify_answer:
                verification_result = self.grounding_verifier.verify_answer(
                    answer=raw_answer,
                    evidence_chunks=accepted_chunks,
                    citations=[str(c.get("chunk_id")) for c in accepted_chunks if isinstance(c, dict) and "chunk_id" in c],
                    target_intents=query_analysis.intents
                )
                if verification_result.is_grounded:
                    final_answer = self.guardrails.append_disclaimer(raw_answer)
                    abstained = False
                elif verification_result.safe_for_partial and verification_result.partial_answer:
                    # Partial answer support (Section 15): Deliver verified components, transparently note unverified parts
                    final_answer = self.guardrails.append_disclaimer(verification_result.partial_answer)
                    abstained = False
                elif ClinicalIntent.DOSAGE in query_analysis.intents:
                    # High-risk numeric fallback: controlled evidence rendering from verified Dosage & Administration section
                    dosage_chunks = [
                        c for c in accepted_chunks
                        if "dosage" in str(c.get("section", "")).lower() or "dosage" in str(c.get("title", "")).lower()
                    ]
                    if dosage_chunks:
                        top_dosage_chunk = dosage_chunks[0]
                        dosage_text = str(top_dosage_chunk.get("text", "")).strip()
                        if dosage_text:
                            rendered_candidate = f"According to verified clinical guidelines for {top_dosage_chunk.get('title', 'this medication')}:\n{dosage_text}"
                            rendered_ver = self.grounding_verifier.verify_answer(
                                answer=rendered_candidate,
                                evidence_chunks=accepted_chunks,
                                citations=[str(top_dosage_chunk.get("chunk_id"))]
                            )
                            if rendered_ver.is_grounded or rendered_ver.safe_for_partial:
                                final_answer = self.guardrails.append_disclaimer(rendered_candidate)
                                verification_result = rendered_ver
                                abstained = False
                            else:
                                fail_reason = verification_result.discrepancies[0] if verification_result.discrepancies else "Numeric dosage could not be verified."
                                suppression_msg = (
                                    "I am not able to verify the clinical accuracy of the generated answer against authoritative guidelines "
                                    f"({fail_reason}). As a patient safety precaution, this answer has been withheld."
                                )
                                final_answer = self.guardrails.append_disclaimer(suppression_msg)
                                abstained = True
                        else:
                            fail_reason = verification_result.discrepancies[0] if verification_result.discrepancies else "Generated assertions could not be deterministically verified against accepted clinical evidence."
                            suppression_msg = (
                                "I am not able to verify the clinical accuracy of the generated answer against authoritative guidelines "
                                f"({fail_reason}). As a patient safety precaution, this answer has been withheld."
                            )
                            final_answer = self.guardrails.append_disclaimer(suppression_msg)
                            abstained = True
                    else:
                        fail_reason = verification_result.discrepancies[0] if verification_result.discrepancies else "Generated assertions could not be deterministically verified against accepted clinical evidence."
                        suppression_msg = (
                            "I am not able to verify the clinical accuracy of the generated answer against authoritative guidelines "
                            f"({fail_reason}). As a patient safety precaution, this answer has been withheld."
                        )
                        final_answer = self.guardrails.append_disclaimer(suppression_msg)
                        abstained = True
                else:
                    fail_reason = verification_result.discrepancies[0] if verification_result.discrepancies else "Generated assertions could not be deterministically verified against accepted clinical evidence."
                    suppression_msg = (
                        "I am not able to verify the clinical accuracy of the generated answer against authoritative guidelines "
                        f"({fail_reason}). As a patient safety precaution, this answer has been withheld."
                    )
                    final_answer = self.guardrails.append_disclaimer(suppression_msg)
                    abstained = True
            else:
                final_answer = self.guardrails.append_disclaimer(raw_answer)
                abstained = False
        else:
            final_answer = "Context retrieved successfully."
            abstained = False

        res = {
            "question": sanitized_query,
            "answer": final_answer,
            "is_emergency": False,
            "abstained": abstained,
            "sources": citations if not abstained else [],
            "retrieved_chunks_count": len(accepted_chunks),
            "pipeline_mode": mode,
            "query_analysis": query_analysis.model_dump()
        }
        if verification_result is not None:
            res["verification"] = {
                "is_grounded": verification_result.is_grounded,
                "verified": verification_result.is_grounded,  # Canonical alias mapping (is_grounded == verified)
                "has_contradiction": verification_result.has_contradiction,
                "candidate_answer": verification_result.answer,
                "grounded_claim_count": verification_result.grounded_claim_count,
                "total_claim_count": verification_result.total_claim_count,
                "failed_claims": verification_result.failed_claims,
                "discrepancies": verification_result.discrepancies,
                "claim_results": [c.model_dump() for c in verification_result.claim_results],
                "safe_for_partial": verification_result.safe_for_partial,
                "partial_answer": verification_result.partial_answer,
                "components": [c.model_dump() for c in verification_result.components]
            }
            # Internal diagnostic provenance retained even when user-facing output is withheld
            res["internal_provenance"] = {
                "query": sanitized_query,
                "retrieved_chunk_ids": [str(c.get("chunk_id")) for c in final_chunks if isinstance(c, dict) and "chunk_id" in c],
                "accepted_chunk_ids": [str(c.get("chunk_id")) for c in accepted_chunks if isinstance(c, dict) and "chunk_id" in c],
                "candidate_answer": verification_result.answer,
                "claim_statuses": {c.claim_text: c.status.value for c in verification_result.claim_results},
                "failed_claims": verification_result.failed_claims,
                "discrepancies": verification_result.discrepancies,
                "final_decision": "GROUNDED" if verification_result.is_grounded else ("PARTIAL_GROUNDED" if verification_result.safe_for_partial else "ABSTAINED_UNVERIFIED"),
                "evidence_chunks": accepted_chunks
            }
        return res
