"""
Unit and regression tests for RAG V2.6-B benchmark rigor, ground-truth integrity, and metrics.
"""

import json
import pickle
import unittest
from pathlib import Path

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.evaluation.evaluator import compute_dcg_at_k, compute_ndcg_at_k
from rag_module.evaluation.leakage_checker import run_leakage_audit
from rag_module.evaluation.failure_analyzer import analyze_query_outcome, summarize_failures


class TestV26BenchmarkRigor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset_path = DEFAULT_CONFIG.BASE_DIR / "evaluation" / "v26_benchmark_dataset.json"
        cls.meta_path = DEFAULT_CONFIG.BASE_DIR / "data" / "faiss_index" / "meta_v2.pkl"

        with open(cls.dataset_path, "r", encoding="utf-8") as f:
            cls.queries = json.load(f)

        with open(cls.meta_path, "rb") as f:
            cls.meta = pickle.load(f)

        cls.chunk_ids = {m["chunk_id"] for m in cls.meta}
        cls.doc_ids = {m["document_id"] for m in cls.meta}

    def test_benchmark_size_and_categories(self):
        """Verify exact 160 queries across 18 clinical categories."""
        self.assertEqual(len(self.queries), 160, f"Expected exactly 160 queries, got {len(self.queries)}")
        categories = set(q["category"] for q in self.queries)
        self.assertEqual(len(categories), 18, f"Expected exactly 18 categories, got {len(categories)}")

    def test_query_id_uniqueness(self):
        """Verify all query IDs and query texts are unique."""
        qids = [q["query_id"] for q in self.queries]
        self.assertEqual(len(qids), len(set(qids)), "Duplicate query_ids found!")
        qtexts = [q["query"].strip().lower() for q in self.queries]
        self.assertEqual(len(qtexts), len(set(qtexts)), "Duplicate query texts found!")

    def test_ground_truth_integrity(self):
        """Verify all ground truth chunk IDs and doc IDs exist in the indexed corpus."""
        if not any(m.get("source_id") in ["medquad_nih", "medquad"] for m in self.meta):
            self.skipTest("V2.6 benchmark ground truth integrity requires legacy full MedQuAD corpus")
        for q in self.queries:
            gt_list = q.get("ground_truth", [])
            self.assertGreater(len(gt_list), 0, f"Query {q['query_id']} has empty ground truth!")
            for gt in gt_list:
                self.assertIn(gt["chunk_id"], self.chunk_ids, f"Chunk ID {gt['chunk_id']} missing from index!")
                self.assertIn(gt["document_id"], self.doc_ids, f"Doc ID {gt['document_id']} missing from index!")
                self.assertIn(gt["relevance_grade"], (1, 2, 3), f"Invalid relevance grade: {gt['relevance_grade']}")

    def test_leakage_audit_pass(self):
        """Verify leakage audit passes with zero critical n-gram leaks."""
        if not any(m.get("source_id") in ["medquad_nih", "medquad"] for m in self.meta):
            self.skipTest("V2.6 benchmark leakage audit requires legacy full MedQuAD corpus")
        report = run_leakage_audit(
            dataset_path=str(self.dataset_path),
            meta_path=str(self.meta_path)
        )
        self.assertTrue(report["audit_passed"], f"Leakage audit failed: {report['summary']}")
        self.assertEqual(report["summary"]["duplicate_count"], 0)
        self.assertEqual(report["summary"]["invalid_chunk_count"], 0)
        self.assertEqual(report["summary"]["high_ngram_leakage_count"], 0)

    def test_ndcg_math(self):
        """Verify nDCG mathematical properties."""
        # Perfect ranking
        ideal = [3, 2, 1]
        retrieved_perfect = [3, 2, 1]
        ndcg_perfect = compute_ndcg_at_k(retrieved_perfect, ideal, k=3)
        self.assertAlmostEqual(ndcg_perfect, 1.0, places=4)

        # Reversed ranking
        retrieved_reversed = [1, 2, 3]
        ndcg_reversed = compute_ndcg_at_k(retrieved_reversed, ideal, k=3)
        self.assertLess(ndcg_reversed, 1.0)
        self.assertGreater(ndcg_reversed, 0.0)

        # Zero relevance
        retrieved_zero = [0, 0, 0]
        ndcg_zero = compute_ndcg_at_k(retrieved_zero, ideal, k=3)
        self.assertEqual(ndcg_zero, 0.0)

    def test_failure_analyzer_categories(self):
        """Verify failure analyzer categorizes diagnostic outcomes correctly."""
        sample_q = {
            "query_id": "test_001",
            "target_entity": "Lisinopril",
            "target_section": "Boxed Warning",
            "acceptable_entities": ["Lisinopril"],
            "acceptable_sources": ["DailyMed"],
            "ground_truth": [{"chunk_id": "chunk_1", "document_id": "doc_1"}]
        }

        # Case 1: Rank 1 match
        ret_1 = [{"chunk_id": "chunk_1", "document_id": "doc_1", "source_id": "DailyMed", "title": "Lisinopril", "section": "Boxed Warning"}]
        out_1 = analyze_query_outcome(sample_q, ret_1)
        self.assertEqual(out_1["category"], "SUCCESS_RANK_1")

        # Case 2: Rank 2 match
        ret_2 = [
            {"chunk_id": "chunk_x", "document_id": "doc_x", "source_id": "DailyMed", "title": "Lisinopril", "section": "Adverse Reactions"},
            {"chunk_id": "chunk_1", "document_id": "doc_1", "source_id": "DailyMed", "title": "Lisinopril", "section": "Boxed Warning"}
        ]
        out_2 = analyze_query_outcome(sample_q, ret_2)
        self.assertEqual(out_2["category"], "RETRIEVED_RANK_GT_1")

        # Case 3: Wrong section same entity
        ret_3 = [{"chunk_id": "chunk_other", "document_id": "doc_other", "source_id": "DailyMed", "title": "Lisinopril", "section": "Adverse Reactions"}]
        out_3 = analyze_query_outcome(sample_q, ret_3)
        self.assertEqual(out_3["category"], "WRONG_SECTION_SAME_ENTITY")

        # Case 4: Wrong entity same source
        ret_4 = [{"chunk_id": "chunk_other", "document_id": "doc_other", "source_id": "DailyMed", "title": "Metformin", "section": "Boxed Warning"}]
        out_4 = analyze_query_outcome(sample_q, ret_4)
        self.assertEqual(out_4["category"], "WRONG_ENTITY_SAME_SOURCE")

        # Case 5: Wrong source
        ret_5 = [{"chunk_id": "chunk_mq", "document_id": "doc_mq", "source_id": "CancerGov", "title": "Leukemia", "section": "information"}]
        out_5 = analyze_query_outcome(sample_q, ret_5)
        self.assertEqual(out_5["category"], "WRONG_SOURCE")


if __name__ == "__main__":
    unittest.main()
