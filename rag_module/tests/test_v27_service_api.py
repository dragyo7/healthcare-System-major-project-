"""
Unit and Integration Tests for RAG V2.7 — RAG Service & Backend Foundation.
Tests service initialization, request validation, retrieval orchestration,
filtering, error handling, health reporting, and FastAPI integration.
"""
import unittest
from pathlib import Path
from pydantic import ValidationError
from fastapi.testclient import TestClient

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.service import (
    RAGService,
    get_rag_service,
    RAGQueryRequest,
    RAGQueryResponse,
    EvidenceItem,
    RAGServiceHealth,
    RetrievalMode,
    InvalidQueryError,
    UnsupportedModeError,
    ServiceNotReadyError
)
from rag_module.api import app


class TestRAGV27ServiceLayer(unittest.TestCase):
    """Unit tests for RAGService core capabilities."""

    @classmethod
    def setUpClass(cls):
        """Initializes service once for the test suite."""
        cls.service = RAGService(config=DEFAULT_CONFIG)
        cls.has_index = cls.service.is_ready()

    def test_01_service_initialization_against_production_index(self):
        """Verify service loads against the canonical production index."""
        self.assertTrue(self.has_index, "Service should be ready with production indexes.")
        health = self.service.get_health()
        self.assertIsInstance(health, RAGServiceHealth)
        self.assertTrue(health.service_ready)
        self.assertTrue(health.index_ready)
        self.assertGreaterEqual(health.indexed_chunks_count, 20000, "Index should contain >= 20k chunks.")
        self.assertEqual(health.version, "2.7.0")
        self.assertIn(health.status, ["healthy", "degraded"])

    def test_02_dense_retrieval_mode(self):
        """Verify Dense retrieval mode returns valid structured evidence."""
        if not self.service.dense_retriever:
            self.skipTest("Dense retriever not available.")

        req = RAGQueryRequest(query="What is the recommended dosage for metformin?", mode=RetrievalMode.DENSE, top_k=3)
        res = self.service.retrieve(req)

        self.assertIsInstance(res, RAGQueryResponse)
        self.assertEqual(res.retrieval_mode, "dense")
        self.assertEqual(len(res.evidence), 3)
        self.assertGreater(res.latency_ms, 0.0)
        self.assertIn("metformin", res.query.lower())

        for item in res.evidence:
            self.assertIsInstance(item, EvidenceItem)
            self.assertGreaterEqual(item.rank, 1)
            self.assertIsNotNone(item.chunk_id)
            self.assertIsNotNone(item.text)
            self.assertIsNotNone(item.dense_score)

    def test_03_bm25_retrieval_mode(self):
        """Verify BM25 retrieval mode returns valid structured evidence."""
        if not self.service.bm25_retriever:
            self.skipTest("BM25 retriever not available.")

        req = RAGQueryRequest(query="lisinopril ACE inhibitor hypertension", mode=RetrievalMode.BM25, top_k=3)
        res = self.service.retrieve(req)

        self.assertIsInstance(res, RAGQueryResponse)
        self.assertEqual(res.retrieval_mode, "bm25")
        self.assertEqual(len(res.evidence), 3)
        for item in res.evidence:
            self.assertIsInstance(item, EvidenceItem)
            self.assertIsNotNone(item.bm25_score)

    def test_04_hybrid_retrieval_mode(self):
        """Verify Hybrid retrieval mode (RRF) combines scores properly."""
        if not self.service.hybrid_retriever:
            self.skipTest("Hybrid retriever not available.")

        req = RAGQueryRequest(query="atorvastatin boxed warnings liver enzymes", mode=RetrievalMode.HYBRID, top_k=5)
        res = self.service.retrieve(req)

        self.assertIsInstance(res, RAGQueryResponse)
        self.assertEqual(res.retrieval_mode, "hybrid")
        self.assertEqual(len(res.evidence), 5)
        for item in res.evidence:
            self.assertIsInstance(item, EvidenceItem)
            self.assertIsNotNone(item.fused_score)

    def test_05_hybrid_rerank_mode_fallback_disclosure(self):
        """Verify Hybrid Rerank mode executes and reports fallback status honestly."""
        req = RAGQueryRequest(query="amoxicillin clavulanate pediatric dosage", mode=RetrievalMode.HYBRID_RERANK, top_k=3)
        res = self.service.retrieve(req)

        self.assertIsInstance(res, RAGQueryResponse)
        self.assertIn(res.reranker_status, ["fallback_pass_through", "available", "disabled"])
        self.assertEqual(len(res.evidence), 3)

    def test_06_source_filter_dailymed(self):
        """Verify source_filter restricts retrieval strictly to specified sources."""
        req = RAGQueryRequest(
            query="omeprazole indications and contraindications",
            mode=RetrievalMode.HYBRID,
            top_k=5,
            source_filter=["DailyMed"]
        )
        res = self.service.retrieve(req)

        self.assertGreater(len(res.evidence), 0)
        for item in res.evidence:
            self.assertEqual(item.source_id.lower(), "dailymed", f"Evidence source should be DailyMed, got {item.source_id}")

    def test_07_domain_filter_pharmacology(self):
        """Verify domain_filter restricts retrieval to specified medical domains."""
        req = RAGQueryRequest(
            query="metformin side effects",
            mode=RetrievalMode.HYBRID,
            top_k=3,
            domain_filter=["pharmacology"]
        )
        res = self.service.retrieve(req)

        self.assertGreater(len(res.evidence), 0)
        for item in res.evidence:
            self.assertEqual(item.medical_domain.lower(), "pharmacology")

    def test_08_section_filter(self):
        """Verify section_filter post-filters evidence by clinical section."""
        req = RAGQueryRequest(
            query="lisinopril contraindications pregnancy",
            mode=RetrievalMode.HYBRID,
            top_k=3,
            section_filter=["contraindications", "warnings & precautions", "boxed warning"]
        )
        res = self.service.retrieve(req)

        for item in res.evidence:
            section_lower = item.section.lower()
            matched = any(s in section_lower or section_lower in s for s in ["contraindications", "warnings & precautions", "boxed warning"])
            self.assertTrue(matched, f"Section '{item.section}' should match requested section filters.")

    def test_09_invalid_query_validation(self):
        """Verify empty and whitespace-only queries are rejected by Pydantic validation."""
        with self.assertRaises(ValidationError):
            RAGQueryRequest(query="", mode=RetrievalMode.HYBRID)

        with self.assertRaises(ValidationError):
            RAGQueryRequest(query="   ", mode=RetrievalMode.HYBRID)

    def test_10_invalid_top_k_validation(self):
        """Verify top_k < 1 or > 100 are rejected."""
        with self.assertRaises(ValidationError):
            RAGQueryRequest(query="valid query", top_k=0)

        with self.assertRaises(ValidationError):
            RAGQueryRequest(query="valid query", top_k=101)

    def test_11_invalid_mode_validation(self):
        """Verify unsupported retrieval mode is rejected."""
        with self.assertRaises(ValidationError):
            RAGQueryRequest(query="valid query", mode="invalid_mode")

    def test_12_provenance_and_citation_preservation(self):
        """Verify all provenance fields are preserved without loss across the service boundary."""
        req = RAGQueryRequest(query="ciprofloxacin tendon rupture boxed warning", mode=RetrievalMode.HYBRID, top_k=2)
        res = self.service.retrieve(req)

        self.assertGreater(len(res.evidence), 0)
        item = res.evidence[0]

        # Check all required provenance attributes
        self.assertTrue(len(item.source_id) > 0)
        self.assertTrue(len(item.source_name) > 0)
        self.assertTrue(len(item.publisher) > 0)
        self.assertTrue(len(item.document_id) > 0)
        self.assertTrue(len(item.chunk_id) > 0)
        self.assertTrue(len(item.title) > 0)
        self.assertTrue(len(item.section) > 0)
        self.assertTrue(len(item.medical_domain) > 0)
        self.assertIsInstance(item.source_url, str)
        self.assertTrue(len(item.text) > 0)

    def test_13_no_raw_faiss_bm25_leakage(self):
        """Verify response contains pure serializable data and no raw index handles."""
        req = RAGQueryRequest(query="asthma inhaler salbutamol", mode=RetrievalMode.HYBRID, top_k=2)
        res = self.service.retrieve(req)

        # Convert to dictionary and verify JSON serializability
        res_dict = res.model_dump()
        self.assertIn("evidence", res_dict)
        for item_dict in res_dict["evidence"]:
            self.assertNotIn("index", item_dict)
            self.assertNotIn("faiss", item_dict)
            self.assertNotIn("_inverted_index", item_dict)
            self.assertIsInstance(item_dict["score"], float)

    def test_14_context_builder_integration(self):
        """Verify context_text is formatted into clean XML/delimited blocks."""
        req = RAGQueryRequest(query="hypertension treatment guidelines", mode=RetrievalMode.HYBRID, top_k=2)
        res = self.service.retrieve(req)

        self.assertIsInstance(res.context_text, str)
        self.assertTrue(len(res.context_text) > 0)
        self.assertIn("[Doc 1:", res.context_text)


class TestRAGV27FastAPIIntegration(unittest.TestCase):
    """Integration tests for FastAPI endpoints."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_15_api_health_endpoint(self):
        """Verify GET /rag/health and GET /health return 200 with valid schema."""
        for path in ["/rag/health", "/health"]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("status", data)
            self.assertIn("service_ready", data)
            self.assertIn("indexed_chunks_count", data)
            self.assertIn("version", data)
            self.assertEqual(data["version"], "2.7.0")

    def test_16_api_readiness_endpoint(self):
        """Verify GET /rag/ready and GET /ready return 200."""
        for path in ["/rag/ready", "/ready"]:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data.get("ready"), True)

    def test_17_api_post_rag_query_success(self):
        """Verify POST /rag/query processes valid request and returns 200."""
        payload = {
            "query": "What are the common side effects of amlodipine?",
            "mode": "hybrid",
            "top_k": 3
        }
        response = self.client.post("/rag/query", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["retrieval_mode"], "hybrid")
        self.assertEqual(len(data["evidence"]), 3)
        self.assertIn("evidence", data)
        self.assertIn("latency_ms", data)
        self.assertIn("context_text", data)

    def test_18_api_validation_error_handling(self):
        """Verify invalid payload returns 400 with clean error structure and no stack trace."""
        # Empty query
        response = self.client.post("/rag/query", json={"query": "", "mode": "hybrid"})
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("error", data)
        self.assertIn("message", data)
        self.assertNotIn("Traceback", response.text)
        self.assertNotIn("E:\\", response.text)

        # Invalid mode
        response = self.client.post("/rag/query", json={"query": "valid query", "mode": "unknown_mode"})
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn("error", data)

    def test_19_api_compatibility_retrieve_endpoint(self):
        """Verify backward compatible POST /retrieve endpoint works."""
        payload = {
            "query": "warfarin drug interactions",
            "mode": "dense",
            "top_k": 2
        }
        response = self.client.post("/retrieve", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["evidence"]), 2)


if __name__ == "__main__":
    unittest.main()
