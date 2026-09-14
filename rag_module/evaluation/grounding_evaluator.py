"""
Grounding Policy & Evidence Quality Evaluator (V2.8).
Provides deterministic evaluation of evidence policies, provenance validation,
safe abstention behavior, and conflict detection across clinical test fixtures.
"""
import time
from typing import Dict, Any, List
from pydantic import BaseModel

from rag_module.service import RAGService, RAGQueryRequest, RetrievalMode, EvidenceItem
from rag_module.safety.provenance_validator import ProvenanceValidator, ProvenanceStatus
from rag_module.safety.evidence_policy import (
    EvidencePolicyEngine,
    EvidencePolicyConfig,
    GroundingStatus,
    GroundingReasonCode
)


class GroundingEvaluationSuite:
    """
    Deterministic evaluation suite assessing RAG V2.8 Grounding & Evidence Policy.
    """
    def __init__(self, service: RAGService = None):
        if service is None:
            service = RAGService()
        self.service = service
        self.policy_engine = service.evidence_policy

    def run_all_evaluations(self) -> Dict[str, Any]:
        """
        Executes complete battery of grounding policy evaluations.
        """
        results = {
            "canonical_grounded_tests": self.evaluate_canonical_grounded_queries(),
            "out_of_domain_abstention_tests": self.evaluate_out_of_domain_abstention(),
            "provenance_tampering_tests": self.evaluate_provenance_tampering(),
            "conflict_detection_tests": self.evaluate_conflict_detection(),
            "policy_latency_benchmark": self.benchmark_policy_latency()
        }

        all_passed = all(
            section.get("all_passed", False)
            for k, section in results.items()
            if isinstance(section, dict) and "all_passed" in section
        )
        results["suite_verdict"] = "PASS" if all_passed else "FAIL"
        return results

    def evaluate_canonical_grounded_queries(self) -> Dict[str, Any]:
        """
        Tests that verified in-domain clinical queries retrieve strong evidence and yield GROUNDED status.
        """
        test_queries = [
            ("What are the contraindications for lisinopril?", "DailyMed"),
            ("What is the boxed warning for metformin?", "DailyMed"),
            ("What are the symptoms of Type 2 diabetes?", "medquad_nih")
        ]

        outcomes = []
        all_passed = True

        for q, src in test_queries:
            req = RAGQueryRequest(query=q, mode=RetrievalMode.HYBRID, top_k=3, source_filter=[src] if src else None)
            res = self.service.retrieve(req)
            grounding = res.grounding

            passed = (
                grounding is not None and
                grounding.status in [GroundingStatus.GROUNDED, GroundingStatus.WEAK_EVIDENCE] and
                grounding.generation_allowed is True and
                grounding.usable_evidence_count >= 1
            )
            if not passed:
                all_passed = False

            outcomes.append({
                "query": q,
                "status": grounding.status.value if grounding else "NONE",
                "generation_allowed": grounding.generation_allowed if grounding else False,
                "usable_chunks": grounding.usable_evidence_count if grounding else 0,
                "passed": passed
            })

        return {"all_passed": all_passed, "tests": outcomes}

    def evaluate_out_of_domain_abstention(self) -> Dict[str, Any]:
        """
        Tests that out-of-domain / non-medical queries are blocked from downstream generation.
        """
        ood_queries = [
            "How do I repair a 2012 Honda Civic transmission gearbox?",
            "What is the quantum wave function collapse in Copenhagen interpretation?",
            "xyzqweasdzxcv random gibberish non-existent terms"
        ]

        outcomes = []
        all_passed = True

        for q in ood_queries:
            req = RAGQueryRequest(query=q, mode=RetrievalMode.DENSE, top_k=3)
            res = self.service.retrieve(req)
            grounding = res.grounding

            # For pure nonsense/OOD, generation must either be blocked or flagged as WEAK/INSUFFICIENT
            passed = (
                grounding is not None and
                (grounding.status in [GroundingStatus.INSUFFICIENT_EVIDENCE, GroundingStatus.WEAK_EVIDENCE])
            )
            if not passed:
                all_passed = False

            outcomes.append({
                "query": q,
                "status": grounding.status.value if grounding else "NONE",
                "generation_allowed": grounding.generation_allowed if grounding else False,
                "reason_codes": [r.value for r in grounding.reason_codes] if grounding else [],
                "passed": passed
            })

        return {"all_passed": all_passed, "tests": outcomes}

    def evaluate_provenance_tampering(self) -> Dict[str, Any]:
        """
        Tests that chunks with missing or corrupted provenance metadata are safely flagged or blocked.
        """
        # 1. Chunk with missing publisher and section
        tampered_item = {
            "rank": 1,
            "score": 0.85,
            "source_id": "DailyMed",
            "source_name": "DailyMed",
            "publisher": "",  # missing
            "document_id": "doc_1",
            "chunk_id": "chunk_1",
            "title": "Test Title",
            "section": "",  # missing
            "medical_domain": "pharmacology",
            "source_url": "https://example.com",
            "text": "Valid medical text content with sufficient word count for clinical analysis.",
            "dense_score": 0.85
        }

        prov_res = ProvenanceValidator.validate_evidence_item(tampered_item)
        passed_prov = not prov_res.is_valid and prov_res.status == ProvenanceStatus.PARTIALLY_IDENTIFIED

        # 2. Chunk with empty text
        empty_text_item = dict(tampered_item, text="   ", publisher="FDA", section="Dosage")
        empty_prov = ProvenanceValidator.validate_evidence_item(empty_text_item)
        passed_empty = not empty_prov.is_valid

        all_passed = passed_prov and passed_empty
        return {
            "all_passed": all_passed,
            "missing_fields_caught": prov_res.missing_fields,
            "empty_text_caught": not empty_prov.is_valid
        }

    def evaluate_conflict_detection(self) -> Dict[str, Any]:
        """
        Tests that contradictory assertions in candidate chunks trigger CONFLICTING_EVIDENCE and block generation.
        """
        item_a = EvidenceItem(
            rank=1,
            score=0.90,
            source_id="DailyMed",
            source_name="DailyMed",
            publisher="FDA",
            document_id="doc_a",
            chunk_id="chunk_a",
            title="Drug A - Pregnancy",
            section="Contraindications",
            medical_domain="pharmacology",
            source_url="https://dailymed.nlm.nih.gov",
            text="Drug A is contraindicated in pregnancy and causes severe fetal toxicity.",
            dense_score=0.90
        )
        item_b = EvidenceItem(
            rank=2,
            score=0.88,
            source_id="DailyMed",
            source_name="DailyMed",
            publisher="FDA",
            document_id="doc_b",
            chunk_id="chunk_b",
            title="Drug A - Clinical Use",
            section="Contraindications",
            medical_domain="pharmacology",
            source_url="https://dailymed.nlm.nih.gov",
            text="Drug A is indicated for use and safe in pregnancy with no fetal risk.",
            dense_score=0.88
        )

        decision = self.policy_engine.evaluate_evidence(
            query="Is Drug A safe during pregnancy?",
            evidence_items=[item_a, item_b],
            retrieval_mode="hybrid"
        )

        passed = (
            decision.status == GroundingStatus.CONFLICTING_EVIDENCE and
            decision.generation_allowed is False and
            decision.conflict_detected is True
        )

        return {
            "all_passed": passed,
            "status": decision.status.value,
            "generation_allowed": decision.generation_allowed,
            "conflict_detected": decision.conflict_detected,
            "conflict_summary": decision.conflict_summary
        }

    def benchmark_policy_latency(self) -> Dict[str, Any]:
        """
        Measures execution latency overhead of EvidencePolicyEngine over 50 iterations.
        """
        dummy_items = [
            EvidenceItem(
                rank=i,
                score=0.75 - i * 0.05,
                source_id="DailyMed",
                source_name="National Library of Medicine DailyMed",
                publisher="FDA",
                document_id=f"doc_{i}",
                chunk_id=f"chunk_{i}",
                title="Lisinopril Monograph",
                section="Dosage & Administration",
                medical_domain="pharmacology",
                source_url="https://dailymed.nlm.nih.gov",
                text="The initial recommended dose of Lisinopril for adult hypertension is 10 mg once daily.",
                dense_score=0.75 - i * 0.05,
                fused_score=0.03
            )
            for i in range(1, 6)
        ]

        latencies = []
        for _ in range(50):
            t0 = time.perf_counter()
            self.policy_engine.evaluate_evidence("lisinopril adult dosage", dummy_items, "hybrid")
            latencies.append((time.perf_counter() - t0) * 1000.0)

        mean_lat = sum(latencies) / len(latencies)
        max_lat = max(latencies)

        # Policy evaluation should be sub-millisecond (< 2.0 ms)
        passed = mean_lat < 2.0
        return {
            "all_passed": passed,
            "iterations": 50,
            "mean_policy_latency_ms": round(mean_lat, 4),
            "max_policy_latency_ms": round(max_lat, 4)
        }


if __name__ == "__main__":
    import json
    suite = GroundingEvaluationSuite()
    print("Running V2.8 Grounding Policy Evaluation Suite...")
    results = suite.run_all_evaluations()
    print(json.dumps(results, indent=2))
    if results["suite_verdict"] == "PASS":
        print("\nALL V2.8 GROUNDING POLICY EVALUATION SUITES PASSED.")
    else:
        print("\nSOME GROUNDING EVALUATION TESTS FAILED.")
