"""
Regression tests for RAG quality recovery edge cases:
1. Mechanism of action clinical intent in EvidencePolicyEngine.
2. Numeric dosage subject extraction avoidance in AnswerGroundingVerifier.
3. Section title suffix stripping and combination-product boundary in AnswerGroundingVerifier.
"""
import pytest
from rag_module.safety.evidence_policy import EvidencePolicyEngine, GENERAL_CLINICAL_TERMS
from rag_module.safety.grounding_verifier import AnswerGroundingVerifier


def test_mechanism_of_action_clinical_intent():
    """Verify that 'mechanism' and 'action' are recognized clinical terms."""
    assert "mechanism" in GENERAL_CLINICAL_TERMS
    assert "action" in GENERAL_CLINICAL_TERMS
    assert "actions" in GENERAL_CLINICAL_TERMS

    engine = EvidencePolicyEngine()
    query = "What is the mechanism of action of lisinopril?"
    # Mock evidence chunks containing Lisinopril
    evidence = [
        {
            "chunk_id": "chunk_001",
            "title": "Lisinopril",
            "section": "CLINICAL PHARMACOLOGY",
            "text": "Mechanism of Action: Lisinopril inhibits ACE, preventing the conversion of angiotensin I to angiotensin II.",
            "source": "dailymed",
            "source_id": "dailymed",
            "source_name": "DailyMed",
            "publisher": "National Library of Medicine",
            "document_id": "lisinopril_label",
            "medical_domain": "pharmacology",
            "score": 0.85
        }
    ]
    eval_res = engine.evaluate_evidence(query, evidence, retrieval_mode="hybrid")
    # Must not be rejected as OUT_OF_DOMAIN
    assert eval_res.generation_allowed is True
    assert "OUT_OF_DOMAIN" not in [r.name for r in eval_res.reason_codes]


def test_numeric_dosage_not_extracted_as_subject():
    """Verify that 'dose of 10 mg' does not cause '10' to be extracted as subject entity."""
    verifier = AnswerGroundingVerifier()
    claim = "The recommended initial dose of 10 mg once daily was given."
    prop = verifier.extract_proposition(claim)
    assert prop is not None
    # Subject must NOT be '10'
    assert prop.subject != "10"
    assert not (prop.subject and prop.subject[0].isdigit())


def test_section_title_suffix_and_combo_boundary():
    """
    Verify that section headers like 'Indications and Usage' in single-agent drugs
    do not cause false combination-product rejection, while true combination products
    are still strictly isolated.
    """
    verifier = AnswerGroundingVerifier()
    # Single-agent drug with section header must be compatible with bare drug
    assert verifier._check_entity_compatibility("Lisinopril - Indications and Usage", "Lisinopril") is True
    assert verifier._check_entity_compatibility("Metformin - Warnings and Precautions", "Metformin") is True

    # True combination product must still be strictly blocked against single-agent
    assert verifier._check_entity_compatibility("Amoxicillin and Clavulanate Potassium", "Amoxicillin") is False
    assert verifier._check_entity_compatibility("Amoxicillin", "Amoxicillin and Clavulanate Potassium") is False
