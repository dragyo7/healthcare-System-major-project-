"""
V2.9 Pipeline and /chat Integration Test Suite.
Verifies post-generation grounding verification and fail-closed suppression in
MedicalRAGPipeline and the FastAPI /chat endpoint.
"""
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from rag_module.config.rag_config import DEFAULT_CONFIG, RAGConfig
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.safety.evidence_policy import EvidencePolicyEngine, GroundingDecision, GroundingStatus
from rag_module.safety.grounding_verifier import AnswerGroundingVerifier, ClaimStatus
from rag_module.generation.generator_v2 import MedicalGenerator
from rag_module.rag_pipeline import MedicalRAGPipeline
from rag_module.api import app, get_legacy_pipeline


class DeterministicMockGenerator(MedicalGenerator):
    """Configurable mock generator to inject specific candidate answers."""
    def __init__(self, answer_to_return: str):
        self.answer_to_return = answer_to_return

    def generate(self, query: str, context: str, system_prompt=None) -> str:
        return self.answer_to_return


class TestMedicalRAGPipelineVerification(unittest.TestCase):
    """Integration tests for MedicalRAGPipeline post-generation verification."""

    def setUp(self):
        self.config = RAGConfig()
        self.evidence_chunk = {
            "chunk_id": "chunk_lis_001",
            "title": "Lisinopril Tablets Monograph",
            "section": "Clinical Pharmacology",
            "text": "Lisinopril inhibits ACE, which decreases blood pressure. The recommended initial starting dose is 10 mg once daily.",
            "source_id": "DailyMed",
            "source_name": "DailyMed",
            "publisher": "FDA",
            "document_id": "doc_lis_001",
            "medical_domain": "pharmacology",
            "url": "https://dailymed.nlm.nih.gov",
            "dense_score": 0.88
        }
        self.mock_chunks = [self.evidence_chunk]

        bm25 = BM25Retriever()
        bm25.fit(self.mock_chunks)
        self.bm25 = bm25

        class MockDenseRetriever:
            metadata = [self.evidence_chunk]
            def search(self, query, top_k=5):
                return [(0, 0.88)]

        self.dense_retriever = MockDenseRetriever()

    def test_01_pipeline_grounded_answer_allowed(self):
        """A candidate answer with fully supported clinical claims passes verification and is returned."""
        grounded_gen = DeterministicMockGenerator(
            "Lisinopril decreases blood pressure. The initial starting dose is 10 mg once daily."
        )
        pipeline = MedicalRAGPipeline(
            config=self.config,
            dense_retriever=self.dense_retriever,
            bm25_retriever=self.bm25,
            generator=grounded_gen
        )

        res = pipeline.query("What does lisinopril do?", mode="hybrid", generate_answer=True)

        self.assertFalse(res["abstained"])
        self.assertFalse(res["is_emergency"])
        self.assertGreater(len(res["sources"]), 0)
        self.assertIn("Lisinopril decreases blood pressure", res["answer"])
        self.assertIn("Clinical Disclaimer", res["answer"])
        self.assertIn("verification", res)
        self.assertTrue(res["verification"]["is_grounded"])
        self.assertEqual(res["verification"]["grounded_claim_count"], 2)

    def test_02_pipeline_contradicted_answer_suppressed(self):
        """A candidate answer with a polarity reversal (increases vs decreases) fails closed."""
        contradicted_gen = DeterministicMockGenerator(
            "Lisinopril increases blood pressure in patients."
        )
        pipeline = MedicalRAGPipeline(
            config=self.config,
            dense_retriever=self.dense_retriever,
            bm25_retriever=self.bm25,
            generator=contradicted_gen
        )

        res = pipeline.query("What does lisinopril do?", mode="hybrid", generate_answer=True)

        self.assertTrue(res["abstained"])
        self.assertEqual(len(res["sources"]), 0)
        self.assertIn("withheld", res["answer"])
        self.assertIn("CONTRADICTED", res["answer"])
        self.assertIn("verification", res)
        self.assertFalse(res["verification"]["is_grounded"])
        self.assertTrue(res["verification"]["has_contradiction"])

    def test_03_pipeline_unsupported_target_suppressed(self):
        """A candidate answer asserting an ungrounded clinical endpoint fails closed."""
        unsupported_gen = DeterministicMockGenerator(
            "Lisinopril is indicated for the treatment of severe asthma."
        )
        pipeline = MedicalRAGPipeline(
            config=self.config,
            dense_retriever=self.dense_retriever,
            bm25_retriever=self.bm25,
            generator=unsupported_gen
        )

        res = pipeline.query("What does lisinopril do?", mode="hybrid", generate_answer=True)

        self.assertTrue(res["abstained"])
        self.assertEqual(len(res["sources"]), 0)
        self.assertIn("withheld", res["answer"])
        self.assertIn("UNSUPPORTED_BY_EVIDENCE", res["answer"])
        self.assertFalse(res["verification"]["is_grounded"])

    def test_04_pipeline_numeric_property_mismatch_suppressed(self):
        """A candidate answer claiming 40 mg initial dose when evidence says 10 mg fails closed."""
        numeric_mismatch_gen = DeterministicMockGenerator(
            "The initial starting dose of lisinopril is 40 mg once daily."
        )
        pipeline = MedicalRAGPipeline(
            config=self.config,
            dense_retriever=self.dense_retriever,
            bm25_retriever=self.bm25,
            generator=numeric_mismatch_gen
        )

        res = pipeline.query("What is the initial dose of lisinopril?", mode="hybrid", generate_answer=True)

        self.assertTrue(res["abstained"])
        self.assertEqual(len(res["sources"]), 0)
        self.assertIn("withheld", res["answer"])
        self.assertIn("NUMERIC_MISMATCH", res["answer"])
        self.assertFalse(res["verification"]["is_grounded"])

    def test_05_pipeline_verify_answer_disabled(self):
        """When verify_answer=False, raw generated text is returned with disclaimer without verifier check."""
        unsupported_gen = DeterministicMockGenerator(
            "Lisinopril is indicated for the treatment of severe asthma."
        )
        pipeline = MedicalRAGPipeline(
            config=self.config,
            dense_retriever=self.dense_retriever,
            bm25_retriever=self.bm25,
            generator=unsupported_gen
        )

        res = pipeline.query("What does lisinopril do?", mode="hybrid", generate_answer=True, verify_answer=False)

        self.assertFalse(res["abstained"])
        self.assertIn("severe asthma", res["answer"])
        self.assertIn("Clinical Disclaimer", res["answer"])
        self.assertNotIn("verification", res)

    def test_06_pipeline_generate_answer_false_returns_context_only(self):
        """When generate_answer=False, returns 'Context retrieved successfully.' without calling generator or verifier."""
        pipeline = MedicalRAGPipeline(
            config=self.config,
            dense_retriever=self.dense_retriever,
            bm25_retriever=self.bm25
        )

        res = pipeline.query("Lisinopril dose", mode="hybrid", generate_answer=False)

        self.assertFalse(res["abstained"])
        self.assertEqual(res["answer"], "Context retrieved successfully.")
        self.assertGreater(len(res["sources"]), 0)


class TestChatEndpointVerification(unittest.TestCase):
    """Integration tests for FastAPI /chat endpoint post-generation verification."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_07_chat_emergency_query_bypasses_generation(self):
        """Emergency query triggers emergency triage immediately without LLM generation."""
        payload = {
            "query": "I have severe crushing chest pain radiating down my left arm with shortness of breath",
            "mode": "hybrid",
            "generate_answer": True
        }
        response = self.client.post("/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertTrue(data["is_emergency"])
        self.assertFalse(data["abstained"])
        self.assertEqual(data["pipeline_mode"], "emergency_triage")
        self.assertEqual(data["sources"], [])

    def test_08_chat_grounded_answer_allowed(self):
        """When the generator outputs a grounded answer supported by retrieved evidence, /chat allows it."""
        pipeline = get_legacy_pipeline()
        original_gen = pipeline.generator

        try:
            # Inject mock generator that produces a proposition matching lisinopril monograph in production index
            pipeline.generator = DeterministicMockGenerator(
                "Lisinopril is indicated for the treatment of hypertension."
            )

            payload = {
                "query": "What is lisinopril indicated for?",
                "mode": "hybrid",
                "generate_answer": True,
                "top_k": 3
            }
            response = self.client.post("/chat", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()

            self.assertFalse(data["abstained"])
            self.assertFalse(data["is_emergency"])
            self.assertGreater(len(data["sources"]), 0)
            self.assertIn("hypertension", data["answer"].lower())
            self.assertIn("Clinical Disclaimer", data["answer"])
        finally:
            pipeline.generator = original_gen

    def test_09_chat_hallucinated_answer_fails_closed(self):
        """When the generator outputs an ungrounded hallucination, /chat suppresses the answer and abstains."""
        pipeline = get_legacy_pipeline()
        original_gen = pipeline.generator

        try:
            # Inject mock generator that hallucinates an unsupported disease
            pipeline.generator = DeterministicMockGenerator(
                "Lisinopril is indicated for the treatment of viral hepatitis."
            )

            payload = {
                "query": "What is lisinopril indicated for?",
                "mode": "hybrid",
                "generate_answer": True,
                "top_k": 3
            }
            response = self.client.post("/chat", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()

            self.assertTrue(data["abstained"])
            self.assertEqual(len(data["sources"]), 0)
            self.assertIn("withheld", data["answer"])
            self.assertIn("UNSUPPORTED_BY_EVIDENCE", data["answer"])
        finally:
            pipeline.generator = original_gen

    def test_10_chat_generate_answer_false_returns_context(self):
        """When generate_answer=False, /chat returns context confirmation without running generator."""
        payload = {
            "query": "What is the starting dose of lisinopril?",
            "mode": "hybrid",
            "generate_answer": False,
            "top_k": 3
        }
        response = self.client.post("/chat", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertFalse(data["abstained"])
        self.assertEqual(data["answer"], "Context retrieved successfully.")
        self.assertGreater(len(data["sources"]), 0)

    def test_11_chat_invokes_verifier_exactly_once(self):
        """The normal /chat execution path invokes verify_answer exactly once."""
        pipeline = get_legacy_pipeline()
        original_gen = pipeline.generator
        try:
            pipeline.generator = DeterministicMockGenerator(
                "Lisinopril is indicated for the treatment of hypertension."
            )
            with patch.object(
                pipeline.grounding_verifier,
                "verify_answer",
                wraps=pipeline.grounding_verifier.verify_answer
            ) as spy_verifier:
                payload = {
                    "query": "What is lisinopril indicated for?",
                    "mode": "hybrid",
                    "generate_answer": True,
                    "top_k": 3
                }
                response = self.client.post("/chat", json=payload)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(spy_verifier.call_count, 1)
        finally:
            pipeline.generator = original_gen

    def test_12_chat_public_request_cannot_bypass_verification(self):
        """Public /chat payload attempting to disable verification via verify_answer=False is ignored and safety is enforced."""
        pipeline = get_legacy_pipeline()
        original_gen = pipeline.generator
        try:
            # Inject hallucinated answer that MUST be withheld
            pipeline.generator = DeterministicMockGenerator(
                "Lisinopril is indicated for the treatment of viral hepatitis."
            )
            payload = {
                "query": "What is lisinopril indicated for?",
                "mode": "hybrid",
                "generate_answer": True,
                "verify_answer": False,  # Attempted bypass
                "top_k": 3
            }
            response = self.client.post("/chat", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()

            # The answer MUST be withheld, fail-closed cannot be bypassed
            self.assertTrue(data["abstained"])
            self.assertEqual(len(data["sources"]), 0)
            self.assertIn("withheld", data["answer"])
        finally:
            pipeline.generator = original_gen

    def test_13_trace_endpoint_exposes_internal_provenance(self):
        """Diagnostic /rag/trace endpoint retains complete internal provenance and verification breakdown."""
        pipeline = get_legacy_pipeline()
        original_gen = pipeline.generator
        try:
            pipeline.generator = DeterministicMockGenerator(
                "Lisinopril is indicated for the treatment of hypertension."
            )
            payload = {
                "query": "What is lisinopril indicated for?",
                "top_k": 3
            }
            response = self.client.post("/rag/trace", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()

            self.assertIn("verification", data)
            self.assertIn("internal_provenance", data)
            if data["verification"] is not None:
                self.assertTrue(data["verification"]["is_grounded"])
                self.assertTrue(data["verification"]["verified"])
                self.assertIn("claim_results", data["verification"])
            if data["internal_provenance"] is not None:
                self.assertIn("candidate_answer", data["internal_provenance"])
                self.assertIn("claim_statuses", data["internal_provenance"])
                self.assertIn("final_decision", data["internal_provenance"])
        finally:
            pipeline.generator = original_gen


    def test_14_generator_clean_filler(self):
        """Conversational filler (Sure!, Certainly!, Yes,) is cleanly stripped by generator post-processing."""
        context = "[Doc 1: Lisinopril Tablets Monograph | Source: DailyMed]\nLisinopril inhibits ACE, which decreases blood pressure."
        raw_output = "Sure! Lisinopril inhibits ACE, which decreases blood pressure."
        cleaned = MedicalGenerator.clean_generation_output(raw_output, context)
        self.assertEqual(cleaned, "Lisinopril inhibits ACE, which decreases blood pressure.")

        # Test verification passes on cleaned output
        verifier = AnswerGroundingVerifier()
        mock_chunk = {"chunk_id": "c1", "text": "Lisinopril inhibits ACE, which decreases blood pressure.", "title": "Lisinopril"}
        v_res = verifier.verify_answer(cleaned, [mock_chunk], ["c1"])
        self.assertTrue(v_res.is_grounded)

    def test_15_generator_pronoun_anaphora_resolution(self):
        """Leading pronouns are dynamically resolved to the primary clinical entity from context Doc 1."""
        context = "[Doc 1: Lisinopril Oral: Uses, Side Effects | Source: WebMD]\nLisinopril decreases blood pressure by blocking angiotensin II."
        raw_output = "It works by blocking the action of angiotensin II, which can help lower blood pressure."
        cleaned = MedicalGenerator.clean_generation_output(raw_output, context)
        self.assertTrue(cleaned.startswith("Lisinopril works by blocking"), f"Actual: {cleaned}")

        # Test verification passes when pronoun is resolved to the correct entity
        verifier = AnswerGroundingVerifier()
        mock_chunk = {"chunk_id": "c1", "text": "Lisinopril works by blocking the action of angiotensin II, which can help lower blood pressure.", "title": "Lisinopril"}
        v_res = verifier.verify_answer(cleaned, [mock_chunk], ["c1"])
        self.assertTrue(v_res.is_grounded)

    def test_16_generator_fail_closed_on_unsupported_anaphora(self):
        """Resolving pronouns on unsupported clinical claims still results in strict fail-closed suppression."""
        context = "[Doc 1: Lisinopril Tablets Monograph | Source: DailyMed]\nLisinopril decreases blood pressure."
        raw_output = "It is indicated for the treatment of viral hepatitis."
        cleaned = MedicalGenerator.clean_generation_output(raw_output, context)
        self.assertTrue(cleaned.startswith("Lisinopril is indicated for the treatment of viral hepatitis"))

        verifier = AnswerGroundingVerifier()
        mock_chunk = {"chunk_id": "c1", "text": "Lisinopril decreases blood pressure.", "title": "Lisinopril"}
        v_res = verifier.verify_answer(cleaned, [mock_chunk], ["c1"])
        self.assertFalse(v_res.is_grounded)
        self.assertEqual(v_res.failed_claims[0], cleaned)

    def test_17_generator_fail_closed_on_contradiction_anaphora(self):
        """Resolving pronouns on contradicted clinical claims still results in strict fail-closed suppression."""
        context = "[Doc 1: Lisinopril Tablets Monograph | Source: DailyMed]\nLisinopril is contraindicated in pregnancy and causes fetal toxicity."
        raw_output = "It is safe for use during pregnancy."
        cleaned = MedicalGenerator.clean_generation_output(raw_output, context)
        self.assertTrue(cleaned.startswith("Lisinopril is safe for use during pregnancy"))

        verifier = AnswerGroundingVerifier()
        mock_chunk = {"chunk_id": "c1", "text": "Lisinopril is contraindicated in pregnancy and causes fetal toxicity.", "title": "Lisinopril"}
        v_res = verifier.verify_answer(cleaned, [mock_chunk], ["c1"])
        self.assertFalse(v_res.is_grounded)
        self.assertTrue(v_res.has_contradiction)

    def test_18_generator_numeric_preservation_intact(self):
        """Numeric values and units are verified strictly and fail-closed if corrupted."""
        verifier = AnswerGroundingVerifier()
        mock_chunk = {
            "chunk_id": "c1",
            "text": "The recommended initial starting dose of Lisinopril is 10 mg once daily.",
            "title": "Lisinopril"
        }
        # Correct dose passes
        v_pass = verifier.verify_answer("The recommended initial starting dose of Lisinopril is 10 mg once daily.", [mock_chunk], ["c1"])
        self.assertTrue(v_pass.is_grounded)

        # Corrupted dose (20 mg instead of 10 mg) fails closed
        v_fail_num = verifier.verify_answer("The recommended initial starting dose of Lisinopril is 20 mg once daily.", [mock_chunk], ["c1"])
        self.assertFalse(v_fail_num.is_grounded)

        # Corrupted unit (10 mcg instead of 10 mg) fails closed
        v_fail_unit = verifier.verify_answer("The recommended initial starting dose of Lisinopril is 10 mcg once daily.", [mock_chunk], ["c1"])
        self.assertFalse(v_fail_unit.is_grounded)


if __name__ == "__main__":
    unittest.main()
