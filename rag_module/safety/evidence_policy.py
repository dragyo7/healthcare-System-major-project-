"""
Evidence Policy & Grounding Decision Engine (V2.8).
Evaluates retrieved EvidenceItems against deterministic quality, provenance, coverage,
and consistency policies to produce auditable grounding and abstention decisions.
"""
import time
from enum import Enum
from typing import List, Dict, Any, Optional, Set
import re
from pydantic import BaseModel, Field, ConfigDict

from rag_module.safety.provenance_validator import ProvenanceValidator, ProvenanceStatus


class GroundingStatus(str, Enum):
    """
    Categorical grounding evaluation outcome for retrieved clinical evidence.
    """
    GROUNDED = "grounded"
    WEAK_EVIDENCE = "weak_evidence"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    CONFLICTING_EVIDENCE = "conflicting_evidence"


class GroundingReasonCode(str, Enum):
    """
    Standardized, machine-readable reason codes explaining grounding decisions.
    """
    EVIDENCE_SUFFICIENT = "EVIDENCE_SUFFICIENT"
    NO_EVIDENCE = "NO_EVIDENCE"
    INVALID_PROVENANCE = "INVALID_PROVENANCE"
    LOW_RETRIEVAL_SCORE = "LOW_RETRIEVAL_SCORE"
    INSUFFICIENT_COVERAGE = "INSUFFICIENT_COVERAGE"
    EMPTY_CONTENT = "EMPTY_CONTENT"
    CONFLICT_DETECTED = "CONFLICT_DETECTED"
    OUT_OF_DOMAIN = "OUT_OF_DOMAIN"
    PARTIAL_PROVENANCE = "PARTIAL_PROVENANCE"


class SourcePolicy(BaseModel):
    """
    Policy rules defining source-level authority and requirements.
    """
    preferred_sources: List[str] = Field(
        default_factory=lambda: ["DailyMed", "medquad_nih", "WHO_Guidelines", "openFDA"],
        description="Sources recognized as authoritative."
    )
    strict_provenance_required: bool = Field(default=True, description="Require 100% complete metadata fields.")
    min_word_count: int = Field(default=5, ge=1, description="Minimum words per chunk to consider usable.")

    model_config = ConfigDict(extra="forbid")


class EvidencePolicyConfig(BaseModel):
    """
    Configuration parameters for evidence evaluation.
    NOTE: Similarity thresholds are heuristic retrieval signals, NOT clinical confidence metrics.
    """
    min_usable_chunks: int = Field(default=1, ge=1, description="Minimum usable chunks required for GROUNDED status.")
    dense_grounded_threshold: float = Field(default=0.50, description="Heuristic cosine similarity for strong dense retrieval.")
    dense_weak_threshold: float = Field(default=0.35, description="Heuristic cosine similarity floor before abstention.")
    bm25_weak_threshold: float = Field(default=3.0, description="Heuristic BM25 score floor.")
    hybrid_fused_weak_threshold: float = Field(default=0.005, description="Heuristic RRF fused score floor.")
    allow_weak_generation: bool = Field(default=True, description="Whether weak evidence allows downstream generation with caveats or blocks generation.")
    enable_conflict_detection: bool = Field(default=True, description="Enable metadata-aware evidence conflict scanning.")
    source_policy: SourcePolicy = Field(default_factory=SourcePolicy)

    model_config = ConfigDict(extra="forbid")



class GroundingDecision(BaseModel):
    """
    Auditable grounding and abstention contract produced by EvidencePolicyEngine.
    """
    status: GroundingStatus = Field(..., description="Grounding outcome classification.")
    generation_allowed: bool = Field(..., description="True if evidence is sufficient and safe for downstream generation.")
    evidence_count: int = Field(..., ge=0, description="Total number of evidence items presented.")
    usable_evidence_count: int = Field(..., ge=0, description="Number of evidence items meeting validity and quality filters.")
    provenance_valid: bool = Field(..., description="True if all top usable evidence items have valid provenance.")
    top_evidence_rank: Optional[int] = Field(default=None, description="Rank of highest-scoring usable evidence item.")
    evidence_sources: List[str] = Field(default_factory=list, description="Unique source IDs present in usable evidence.")
    evidence_documents: List[str] = Field(default_factory=list, description="Unique document IDs present in usable evidence.")
    evidence_sections: List[str] = Field(default_factory=list, description="Unique clinical section names present in usable evidence.")
    reason_codes: List[GroundingReasonCode] = Field(default_factory=list, description="Machine-readable decision reason codes.")
    warnings: List[str] = Field(default_factory=list, description="Explanatory warnings for human clinicians/auditors.")
    conflict_detected: bool = Field(default=False, description="True if potential evidence contradiction was detected.")
    conflict_summary: Optional[str] = Field(default=None, description="Summary of conflict signals if detected.")
    policy_latency_ms: float = Field(default=0.0, ge=0.0, description="Latency of evidence policy evaluation in ms.")

    model_config = ConfigDict(extra="forbid")


# Common contradiction marker pairs in clinical texts
CONTRADICTION_PAIRS = [
    (r'\b(contraindicated|do\s+not\s+use|prohibited)\b', r'\b(indicated\s+for|recommended|approved\s+for)\b'),
    (r'\b(not\s+recommended\s+in\s+pregnancy|unsafe\s+in\s+pregnancy|fetal\s+toxicity)\b', r'\b(safe\s+in\s+pregnancy|no\s+fetal\s+risk)\b'),
    (r'\b(fatal|life-threatening|severe\s+toxicity)\b', r'\b(no\s+adverse\s+effects|well-tolerated|minimal\s+risk)\b')
]


COMMON_STOPWORDS = {
    "what", "is", "the", "of", "and", "in", "to", "for", "a", "an", "how", "do", "i", "can",
    "are", "with", "on", "by", "at", "from", "it", "or", "as", "be", "this", "that", "which",
    "should", "have", "has", "had", "does", "about", "tell", "me", "there"
}


class EvidencePolicyEngine:
    """
    Deterministic policy evaluator that assesses retrieved evidence and determines
    whether downstream answer generation should be authorized or safely blocked.
    """
    def __init__(self, config: Optional[EvidencePolicyConfig] = None):
        self.config = config or EvidencePolicyConfig()
        self.contradiction_regexes = [
            (re.compile(p1, re.IGNORECASE), re.compile(p2, re.IGNORECASE))
            for p1, p2 in CONTRADICTION_PAIRS
        ]

    def evaluate_evidence(
        self,
        query: str,
        evidence_items: List[Any],
        retrieval_mode: str = "hybrid"
    ) -> GroundingDecision:
        """
        Evaluates a list of EvidenceItem objects and returns an auditable GroundingDecision.
        """
        start_time = time.perf_counter()
        warnings: List[str] = []
        reason_codes: List[GroundingReasonCode] = []

        # 1. Zero evidence check
        if not evidence_items:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            return GroundingDecision(
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
                warnings=["No relevant evidence chunks were retrieved from the knowledge base."],
                conflict_detected=False,
                conflict_summary=None,
                policy_latency_ms=round(elapsed_ms, 3)
            )

        # 2. Provenance and Quality Screening for each item
        usable_items = []
        sources_set: Set[str] = set()
        docs_set: Set[str] = set()
        sections_set: Set[str] = set()
        all_provenance_valid = True

        for item in evidence_items:
            prov_res = ProvenanceValidator.validate_evidence_item(item)
            if not prov_res.is_valid:
                all_provenance_valid = False
                if prov_res.status == ProvenanceStatus.PARTIALLY_IDENTIFIED:
                    warnings.append(f"Chunk '{prov_res.chunk_id}' has partial provenance: missing {prov_res.missing_fields}")
                else:
                    warnings.append(f"Chunk '{prov_res.chunk_id}' has invalid provenance: missing {prov_res.missing_fields}")
                    continue  # Skip completely invalid chunks

            # Check text length
            text_val = str(getattr(item, "text", "") if hasattr(item, "text") else item.get("text", "")).strip()
            word_count = len(text_val.split())
            if word_count < self.config.source_policy.min_word_count:
                warnings.append(f"Chunk has insufficient text content ({word_count} words).")
                continue

            usable_items.append(item)
            src = str(getattr(item, "source_id", "") if hasattr(item, "source_id") else item.get("source_id", ""))
            doc = str(getattr(item, "document_id", "") if hasattr(item, "document_id") else item.get("document_id", ""))
            sec = str(getattr(item, "section", "") if hasattr(item, "section") else item.get("section", ""))

            if src:
                sources_set.add(src)
            if doc:
                docs_set.add(doc)
            if sec:
                sections_set.add(sec)

        # 3. Handle case where all items failed provenance or quality
        if not usable_items:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            return GroundingDecision(
                status=GroundingStatus.INSUFFICIENT_EVIDENCE,
                generation_allowed=False,
                evidence_count=len(evidence_items),
                usable_evidence_count=0,
                provenance_valid=False,
                top_evidence_rank=None,
                evidence_sources=list(sources_set),
                evidence_documents=list(docs_set),
                evidence_sections=list(sections_set),
                reason_codes=[GroundingReasonCode.INVALID_PROVENANCE, GroundingReasonCode.INSUFFICIENT_COVERAGE],
                warnings=warnings + ["All retrieved candidate chunks failed provenance or quality validation."],
                conflict_detected=False,
                conflict_summary=None,
                policy_latency_ms=round(elapsed_ms, 3)
            )

        top_item = usable_items[0]
        top_rank = int(getattr(top_item, "rank", 1) if hasattr(top_item, "rank") else top_item.get("rank", 1))

        # 4. Lexical Grounding / Substantive Query Term Overlap Check
        # Mitigates dense vector hubness / semantic hallucinations on out-of-domain queries
        query_words = [
            w for w in re.findall(r'\b[a-zA-Z0-9_-]+\b', query.lower())
            if len(w) >= 3 and w not in COMMON_STOPWORDS
        ]

        combined_top_text = " ".join([
            str(getattr(it, "text", "") if hasattr(it, "text") else it.get("text", "")).lower()
            for it in usable_items[:3]
        ])

        overlap_ratio = 1.0
        if query_words:
            matched_words = 0
            for w in query_words:
                # Exact word boundary or meaningful substring
                if re.search(r'\b' + re.escape(w), combined_top_text):
                    matched_words += 1
                elif len(w) >= 6 and re.search(r'\b' + re.escape(w[:5]), combined_top_text):
                    matched_words += 1
            overlap_ratio = matched_words / len(query_words)

        # 5. Heuristic Retrieval Score Evaluation
        mode_lower = retrieval_mode.lower()
        top_score = float(getattr(top_item, "score", 0.0) if hasattr(top_item, "score") else top_item.get("score", 0.0))
        dense_score = getattr(top_item, "dense_score", None) if hasattr(top_item, "dense_score") else top_item.get("dense_score")
        bm25_score = getattr(top_item, "bm25_score", None) if hasattr(top_item, "bm25_score") else top_item.get("bm25_score")

        # Out of domain check: if less than 35% of substantive query words appear in top evidence
        is_out_of_domain = bool(query_words and overlap_ratio < 0.35)

        is_strong = False
        is_weak = False
        is_unsupported = is_out_of_domain

        if not is_unsupported:
            if mode_lower == "dense":
                score_to_check = dense_score if dense_score is not None else top_score
                if score_to_check >= self.config.dense_grounded_threshold and overlap_ratio >= 0.50:
                    is_strong = True
                elif score_to_check >= self.config.dense_weak_threshold:
                    is_weak = True
                else:
                    is_unsupported = True

            elif mode_lower == "bm25":
                score_to_check = bm25_score if bm25_score is not None else top_score
                if score_to_check >= 10.0 and overlap_ratio >= 0.50:
                    is_strong = True
                elif score_to_check >= self.config.bm25_weak_threshold:
                    is_weak = True
                else:
                    is_unsupported = True

            else:  # hybrid or hybrid_rerank
                has_bm25_hit = bm25_score is not None and bm25_score > 0.0
                has_strong_dense = dense_score is not None and dense_score >= self.config.dense_grounded_threshold

                if has_strong_dense and (has_bm25_hit or overlap_ratio >= 0.50):
                    is_strong = True
                elif has_strong_dense or (dense_score is not None and dense_score >= self.config.dense_weak_threshold):
                    is_weak = True
                elif has_bm25_hit and overlap_ratio >= 0.35:
                    is_weak = True
                else:
                    is_unsupported = True

        # 6. Evidence Conflict Analysis
        conflict_detected = False
        conflict_summary = None
        if self.config.enable_conflict_detection and len(usable_items) >= 2:
            conflict_detected, conflict_summary = self._scan_evidence_conflicts(usable_items)

        # 7. Synthesize Final Grounding Decision
        if conflict_detected:
            final_status = GroundingStatus.CONFLICTING_EVIDENCE
            generation_allowed = False
            reason_codes.append(GroundingReasonCode.CONFLICT_DETECTED)
            warnings.append(f"Contradictory evidence signals detected: {conflict_summary}")

        elif is_unsupported:
            final_status = GroundingStatus.INSUFFICIENT_EVIDENCE
            generation_allowed = False
            if is_out_of_domain:
                reason_codes.append(GroundingReasonCode.OUT_OF_DOMAIN)
                warnings.append(f"Substantive query term overlap ({overlap_ratio:.0%}) is below domain threshold; query appears out-of-domain.")
            else:
                reason_codes.append(GroundingReasonCode.LOW_RETRIEVAL_SCORE)
                warnings.append("Top retrieved evidence score is below minimum relevance floor.")

        elif is_weak:
            final_status = GroundingStatus.WEAK_EVIDENCE
            generation_allowed = self.config.allow_weak_generation
            reason_codes.append(GroundingReasonCode.LOW_RETRIEVAL_SCORE)
            if generation_allowed:
                warnings.append("Evidence retrieval scores are marginal; downstream generation should express appropriate clinical caveats.")
            else:
                warnings.append("Evidence retrieval scores are marginal; downstream generation blocked under strict policy.")

        else:  # is_strong
            if len(usable_items) >= self.config.min_usable_chunks:
                final_status = GroundingStatus.GROUNDED
                generation_allowed = True
                reason_codes.append(GroundingReasonCode.EVIDENCE_SUFFICIENT)
            else:
                final_status = GroundingStatus.WEAK_EVIDENCE
                generation_allowed = self.config.allow_weak_generation
                reason_codes.append(GroundingReasonCode.INSUFFICIENT_COVERAGE)
                warnings.append("Usable chunk count is limited.")


        if not all_provenance_valid and final_status == GroundingStatus.GROUNDED:
            reason_codes.append(GroundingReasonCode.PARTIAL_PROVENANCE)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return GroundingDecision(
            status=final_status,
            generation_allowed=generation_allowed,
            evidence_count=len(evidence_items),
            usable_evidence_count=len(usable_items),
            provenance_valid=all_provenance_valid,
            top_evidence_rank=top_rank,
            evidence_sources=sorted(list(sources_set)),
            evidence_documents=sorted(list(docs_set)),
            evidence_sections=sorted(list(sections_set)),
            reason_codes=reason_codes,
            warnings=warnings,
            conflict_detected=conflict_detected,
            conflict_summary=conflict_summary,
            policy_latency_ms=round(elapsed_ms, 3)
        )


    def _scan_evidence_conflicts(self, items: List[Any]) -> (bool, Optional[str]):
        """
        Scans for contradictory assertions between chunks sharing the same entity or section.
        """
        # Compare top 3 chunks pairwise
        sample_items = items[:3]
        for i in range(len(sample_items)):
            text_i = str(getattr(sample_items[i], "text", "") if hasattr(sample_items[i], "text") else sample_items[i].get("text", ""))
            sec_i = str(getattr(sample_items[i], "section", "") if hasattr(sample_items[i], "section") else sample_items[i].get("section", ""))

            for j in range(i + 1, len(sample_items)):
                text_j = str(getattr(sample_items[j], "text", "") if hasattr(sample_items[j], "text") else sample_items[j].get("text", ""))
                sec_j = str(getattr(sample_items[j], "section", "") if hasattr(sample_items[j], "section") else sample_items[j].get("section", ""))

                # Check if both chunks target the same section or same document
                for reg_a, reg_b in self.contradiction_regexes:
                    if (reg_a.search(text_i) and reg_b.search(text_j)) or (reg_b.search(text_i) and reg_a.search(text_j)):
                        return True, f"Conflict detected between Chunk {i+1} ('{sec_i}') and Chunk {j+1} ('{sec_j}') regarding clinical assertions."

        return False, None
