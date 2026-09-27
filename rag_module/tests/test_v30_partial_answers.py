"""
RAG V3.0 — Partial Answers and Component-Level Verification Regression Test Suite.
Tests deterministic component decomposition, component verification, partial answer assembly,
and strict safety-blocking suppression (3/3, 2/3, 1/3, 0/3, contradiction, numeric mismatch,
entity mismatch, qualifier mismatch).
"""
import unittest
from rag_module.safety.grounding_verifier import (
    AnswerGroundingVerifier,
    ClaimStatus,
    AnswerComponent
)


class TestPartialAnswersAndComponents(unittest.TestCase):
    def setUp(self):
        self.verifier = AnswerGroundingVerifier()

        # Multi-section evidence fixture
        self.evidence = [
            {
                "chunk_id": "met_ind_01",
                "title": "Metformin - Indications & Usage",
                "section": "Indications & Usage",
                "text": "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus."
            },
            {
                "chunk_id": "met_adv_01",
                "title": "Metformin - Adverse Reactions",
                "section": "Adverse Reactions",
                "text": "Common adverse reactions include diarrhea, nausea, vomiting, flatulence, and abdominal discomfort."
            },
            {
                "chunk_id": "met_ci_01",
                "title": "Metformin - Contraindications",
                "section": "Contraindications",
                "text": "Metformin is contraindicated in patients with severe renal impairment (eGFR below 30 mL/min/1.73 m2) and acute or chronic metabolic acidosis."
            },
            {
                "chunk_id": "lis_dos_01",
                "title": "Lisinopril - Dosage & Administration",
                "section": "Dosage & Administration",
                "text": "Hypertension: Initial adult dose is 10 mg once daily. Titrate up to 40 mg daily based on blood pressure response."
            }
        ]

    # 1. 3/3 components supported
    def test_3_of_3_supported(self):
        answer = (
            "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes. "
            "Common adverse reactions include diarrhea, nausea, and vomiting. "
            "Metformin is contraindicated in patients with severe renal impairment."
        )
        target_intents = ["indications", "adverse_effects", "contraindications"]
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=self.evidence,
            target_intents=target_intents
        )
        self.assertTrue(res.is_grounded)
        self.assertEqual(len(res.components), 3)
        self.assertTrue(all(c.status == ClaimStatus.SUPPORTED for c in res.components))
        self.assertEqual(res.grounded_claim_count, 3)

    # 2. 2/3 components supported (1 missing/unsupported)
    def test_2_of_3_supported(self):
        answer = (
            "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes. "
            "Common adverse reactions include diarrhea, nausea, and vomiting."
        )
        target_intents = ["indications", "adverse_effects", "contraindications"]
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=self.evidence,
            target_intents=target_intents
        )
        self.assertFalse(res.is_grounded)
        self.assertTrue(res.safe_for_partial)
        self.assertIsNotNone(res.partial_answer)
        self.assertIn("Clinical Note", res.partial_answer)
        self.assertIn("Contraindications", res.partial_answer)

        # Check component statuses
        comp_dict = {c.intent: c.status for c in res.components}
        self.assertEqual(comp_dict["indications"], ClaimStatus.SUPPORTED)
        self.assertEqual(comp_dict["adverse_effects"], ClaimStatus.SUPPORTED)
        self.assertEqual(comp_dict["contraindications"], ClaimStatus.UNSUPPORTED_BY_EVIDENCE)

    # 3. 1/3 components supported (2 missing/unsupported)
    def test_1_of_3_supported(self):
        answer = (
            "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes."
        )
        target_intents = ["indications", "adverse_effects", "contraindications"]
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=self.evidence,
            target_intents=target_intents
        )
        self.assertFalse(res.is_grounded)
        self.assertTrue(res.safe_for_partial)
        self.assertIsNotNone(res.partial_answer)
        self.assertIn("Clinical Note", res.partial_answer)

        comp_dict = {c.intent: c.status for c in res.components}
        self.assertEqual(comp_dict["indications"], ClaimStatus.SUPPORTED)
        self.assertEqual(comp_dict["adverse_effects"], ClaimStatus.UNSUPPORTED_BY_EVIDENCE)
        self.assertEqual(comp_dict["contraindications"], ClaimStatus.UNSUPPORTED_BY_EVIDENCE)

    # 4. 0/3 components supported
    def test_0_of_3_supported(self):
        answer = (
            "Metformin is used to cure hair loss and stimulate follicle regeneration. "
            "Common side effects include purple skin discoloration and hallucinations. "
            "It is contraindicated in patients with blue eye pigmentation."
        )
        target_intents = ["indications", "adverse_effects", "contraindications"]
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=self.evidence,
            target_intents=target_intents
        )
        self.assertFalse(res.is_grounded)
        self.assertFalse(res.safe_for_partial)
        self.assertIsNone(res.partial_answer)

    # 5. Supported component + Contradiction
    def test_supported_plus_contradiction(self):
        answer = (
            "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes. "
            "Metformin increases intestinal absorption of glucose."
        )
        target_intents = ["indications"]
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=[
                {
                    "chunk_id": "met_ind_01",
                    "title": "Metformin - Indications & Usage",
                    "section": "Indications & Usage",
                    "text": "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus. Metformin decreases intestinal absorption of glucose."
                }
            ],
            target_intents=target_intents
        )
        self.assertFalse(res.is_grounded)
        self.assertTrue(res.has_contradiction)
        self.assertFalse(res.safe_for_partial)
        self.assertIsNone(res.partial_answer)

    # 6. Supported component + Numeric mismatch
    def test_supported_plus_numeric_mismatch(self):
        answer = (
            "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes. "
            "The initial dose of lisinopril is 100 mg once daily."
        )
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=self.evidence,
            target_intents=["indications", "dosage"]
        )
        self.assertFalse(res.is_grounded)
        self.assertFalse(res.safe_for_partial)
        self.assertIsNone(res.partial_answer)
        self.assertTrue(any(c.status == ClaimStatus.NUMERIC_MISMATCH for c in res.claim_results))

    # 7. Supported component + Entity mismatch
    def test_supported_plus_entity_mismatch(self):
        answer = (
            "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes. "
            "Amoxicillin decreases intestinal absorption of glucose."
        )
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=self.evidence,
            target_intents=["indications"]
        )
        self.assertFalse(res.is_grounded)
        self.assertFalse(res.safe_for_partial)
        self.assertIsNone(res.partial_answer)
        self.assertTrue(any(c.status == ClaimStatus.ENTITY_MISMATCH for c in res.claim_results))

    # 8. Supported component + Qualifier mismatch
    def test_supported_plus_qualifier_mismatch(self):
        answer = (
            "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes. "
            "Metformin is recommended for pediatric infants under 6 months."
        )
        res = self.verifier.verify_answer(
            answer=answer,
            evidence_chunks=self.evidence,
            target_intents=["indications"]
        )
        self.assertFalse(res.is_grounded)
        self.assertFalse(res.safe_for_partial)
        self.assertIsNone(res.partial_answer)
        self.assertTrue(any(c.status == ClaimStatus.QUALIFIER_MISMATCH for c in res.claim_results))


if __name__ == "__main__":
    unittest.main()
