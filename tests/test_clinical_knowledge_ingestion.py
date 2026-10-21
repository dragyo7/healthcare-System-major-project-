"""
test_clinical_knowledge_ingestion.py

Unit and governance integration test for the 7-Stage Clinical Knowledge Ingestion Pipeline.
Verifies:
1. Source document acquisition with full SetID and version provenance.
2. Section extraction and statement tagging.
3. Brand-to-generic normalization and entity linking.
4. Validation constraints (severity limits, verbatim evidence requirement).
5. Staging invariant: Rules start inactive (is_active=False) with PENDING_CLINICIAN_REVIEW.
6. Governance invariant: Unreviewed or rejected rules CANNOT be published (raises PermissionError).
7. Clinician review governance: Records reviewer name, license, and clinical action.
8. Controlled publication to production with complete provenance trail.
"""

import pytest
import tempfile
import json
from pathlib import Path
from drug_module.ingestion.pipeline import ClinicalKnowledgeIngestionPipeline


@pytest.fixture
def temp_pipeline(tmp_path):
    staging_file = tmp_path / "staged_rules.json"
    production_file = tmp_path / "production_rules.json"
    # Seed initial production rules
    production_file.write_text(json.dumps({
        "rules": [
            {
                "rule_id": "RUL-INT-001",
                "drug_a": "aspirin",
                "drug_b": "warfarin",
                "severity": "major",
                "finding": "Synergistic bleeding risk",
                "clinical_action": "Avoid concomitant use"
            }
        ]
    }))
    return ClinicalKnowledgeIngestionPipeline(
        staging_path=staging_file,
        production_path=production_file,
        audit_secret="TEST_GOVERNANCE_SECRET_KEY_12345"
    )


def test_stage_1_acquisition_validation(temp_pipeline):
    # Missing source_id should fail
    with pytest.raises(ValueError):
        temp_pipeline.stage_1_acquire_source(
            source_id="",
            setid="abc-123",
            document_title="Sample Title",
            version="1.0",
            effective_date="2026-10-18",
            raw_text_content="Some content"
        )

    # Valid acquisition
    doc = temp_pipeline.stage_1_acquire_source(
        source_id="DailyMed_Ciprofloxacin",
        setid="12345678-abcd-ef01-2345-6789abcdef01",
        document_title="Ciprofloxacin Hydrochloride Tablet SPL",
        version="4.2",
        effective_date="2025-06-01",
        raw_text_content="Section 7 Drug Interactions\n\nConcomitant administration of ciprofloxacin with theophylline causes an increase in theophylline plasma concentrations and increased risk of theophylline toxicity.\n\nSection 8 Use in Specific Populations..."
    )
    assert doc["source_id"] == "DailyMed_Ciprofloxacin"
    assert doc["setid"] == "12345678-abcd-ef01-2345-6789abcdef01"
    assert "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=" in doc["source_url"]


def test_stage_2_parse_sections(temp_pipeline):
    doc = {
        "raw_text_content": (
            "Section 7 Drug Interactions\n\n"
            "Concomitant administration of ciprofloxacin with theophylline causes marked inhibition of theophylline metabolism.\n\n"
            "Clinical Pharmacology\n\n"
            "Ciprofloxacin is a broad-spectrum fluoroquinolone."
        )
    }
    statements = temp_pipeline.stage_2_parse_sections(doc)
    assert len(statements) == 1
    assert "theophylline" in statements[0]["verbatim_text"]


def test_stage_3_normalization(temp_pipeline):
    # Brand alias resolution: Cipro -> ciprofloxacin
    norm = temp_pipeline.stage_3_normalize_and_link(
        drug_a_raw="Cipro 500mg",
        drug_b_raw="Theophylline",
        verbatim_text="Co-administration of ciprofloxacin with theophylline causes toxicity."
    )
    assert norm["drug_a_canonical"] == "ciprofloxacin"
    assert norm["drug_b_canonical"] == "theophylline"

    # Identical moieties must be rejected
    with pytest.raises(ValueError):
        temp_pipeline.stage_3_normalize_and_link(
            drug_a_raw="Crocin",
            drug_b_raw="Dolo 650",
            verbatim_text="Duplicate paracetamol"
        )


def test_stage_4_validation_engine(temp_pipeline):
    norm_data = {
        "drug_a_canonical": "ciprofloxacin",
        "drug_b_canonical": "theophylline",
        "verbatim_text": "Ciprofloxacin inhibits theophylline clearance."
    }
    doc = {
        "source_id": "DailyMed",
        "document_title": "Cipro SPL",
        "setid": "set-123"
    }

    # Invalid severity should be rejected
    with pytest.raises(ValueError):
        temp_pipeline.stage_4_validate_rule(
            normalized_data=norm_data,
            severity="extreme_critical_danger",  # Invalid
            finding="Valid finding text with sufficient length",
            acquired_doc=doc
        )

    # Valid validation
    validated = temp_pipeline.stage_4_validate_rule(
        normalized_data=norm_data,
        severity="major",
        finding="Ciprofloxacin significantly inhibits CYP1A2, reducing theophylline clearance and causing toxicity.",
        acquired_doc=doc
    )
    assert validated["severity"] == "major"
    assert validated["drug_a"] == "ciprofloxacin"
    assert validated["drug_b"] == "theophylline"


def test_stage_5_staging_and_governance_invariant(temp_pipeline):
    validated_rule = {
        "drug_a": "ciprofloxacin",
        "drug_b": "theophylline",
        "severity": "major",
        "finding": "Ciprofloxacin inhibits theophylline metabolism, risking life-threatening theophylline toxicity.",
        "verbatim_passage": "Concomitant use of ciprofloxacin with theophylline should be avoided.",
        "source_provenance": {
            "source_id": "DailyMed",
            "source_document_id": "Cipro Label",
            "source_setid": "set-123",
            "source_section": "Section 7"
        }
    }

    # Stage rule
    staged = temp_pipeline.stage_5_stage_rule(validated_rule)
    staged_id = staged["staged_rule_id"]

    assert staged["is_active"] is False
    assert staged["review_status"] == "PENDING_CLINICIAN_REVIEW"
    assert staged["clinician_review"] is None

    # INVARIANT: An unreviewed staged rule CANNOT be published
    with pytest.raises(PermissionError) as exc_info:
        temp_pipeline.stage_7_publish(staged_id)
    assert "Only rules with 'APPROVED_CLINICAL_RULE' can be published" in str(exc_info.value)


def test_stage_6_clinician_rejection(temp_pipeline):
    validated_rule = {
        "drug_a": "drugx",
        "drug_b": "drugy",
        "severity": "minor",
        "finding": "Doubtful minor theoretical interaction without clinical significance.",
        "verbatim_passage": "Minor effect observed in in vitro assay only.",
        "source_provenance": {
            "source_id": "Literature",
            "source_document_id": "In vitro study",
            "source_setid": "lit-999",
            "source_section": "Discussion"
        }
    }
    staged = temp_pipeline.stage_5_stage_rule(validated_rule)
    staged_id = staged["staged_rule_id"]

    # Clinician reviews and REJECTS rule
    rejected = temp_pipeline.stage_6_clinician_review(
        staged_rule_id=staged_id,
        reviewer_name="Dr. Bhumi Sharma, MD",
        reviewer_license="DOC-MH-2024-8841",
        decision="REJECTED",
        clinical_action="",
        review_notes="In vitro finding only; lacks clinically documented in vivo adverse outcomes."
    )
    assert rejected["review_status"] == "REJECTED_CLINICAL_RULE"

    # Rejected rule cannot be published
    with pytest.raises(PermissionError):
        temp_pipeline.stage_7_publish(staged_id)


def test_stage_6_and_7_full_approval_and_publication(temp_pipeline):
    validated_rule = {
        "drug_a": "ciprofloxacin",
        "drug_b": "theophylline",
        "severity": "major",
        "finding": "Ciprofloxacin inhibits theophylline clearance via CYP1A2, elevating serum theophylline to toxic levels.",
        "verbatim_passage": "Avoid concomitant administration of ciprofloxacin and theophylline unless serum levels can be monitored.",
        "source_provenance": {
            "source_id": "DailyMed",
            "source_document_id": "Ciprofloxacin Tablet Label",
            "source_setid": "cipro-spl-444",
            "source_section": "Section 7.1",
            "source_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=cipro-spl-444"
        }
    }
    staged = temp_pipeline.stage_5_stage_rule(validated_rule)
    staged_id = staged["staged_rule_id"]

    # Clinician reviews and APPROVES rule
    reviewed = temp_pipeline.stage_6_clinician_review(
        staged_rule_id=staged_id,
        reviewer_name="Dr. Ananya Sharma, MD",
        reviewer_license="DOC-MH-2024-9912",
        decision="APPROVED",
        clinical_action="Avoid co-administration. If unavoidable, reduce theophylline dosage by 50% and monitor serial theophylline serum concentrations.",
        review_notes="Confirmed authentic DailyMed SPL guidance matching established clinical pharmacology."
    )
    assert reviewed["review_status"] == "APPROVED_CLINICAL_RULE"

    # Publish to production
    prod_rule = temp_pipeline.stage_7_publish(staged_id)
    assert prod_rule["rule_id"] == "RUL-INT-002"
    assert prod_rule["drug_a"] == "ciprofloxacin"
    assert prod_rule["drug_b"] == "theophylline"
    assert prod_rule["provenance_status"] == "VERIFIED"
    assert prod_rule["review_status"] == "APPROVED_CLINICAL_RULE"
    assert prod_rule["ingestion_metadata"]["approved_by"] == "Dr. Ananya Sharma, MD"

    # Verify rule is now in production store
    prod_data = temp_pipeline._read_production()
    assert len(prod_data["rules"]) == 2
    assert prod_data["rules"][1]["rule_id"] == "RUL-INT-002"


def test_stage_6_unauthorized_and_invalid_review(temp_pipeline):
    rule = {
        "drug_a": "drugx",
        "drug_b": "drugy",
        "severity": "major",
        "finding": "Test finding",
        "verbatim_passage": "Verbatim passage",
        "source_provenance": {"source_id": "Test", "source_document_id": "TestDoc", "source_setid": "set1", "source_section": "Sec"}
    }
    staged = temp_pipeline.stage_5_stage_rule(rule)
    staged_id = staged["staged_rule_id"]

    # Missing reviewer name must fail
    with pytest.raises(ValueError) as exc:
        temp_pipeline.stage_6_clinician_review(
            staged_rule_id=staged_id,
            reviewer_name="",
            reviewer_license="DOC-12345",
            decision="APPROVED",
            clinical_action="Avoid concomitant therapy under all circumstances.",
            review_notes=""
        )
    assert "authenticated reviewer_name" in str(exc.value)

    # Invalid/short license must fail
    with pytest.raises(ValueError) as exc_lic:
        temp_pipeline.stage_6_clinician_review(
            staged_rule_id=staged_id,
            reviewer_name="Dr. Valid",
            reviewer_license="123",  # Too short (< 6 chars)
            decision="APPROVED",
            clinical_action="Avoid concomitant therapy under all circumstances.",
            review_notes=""
        )
    assert "valid medical license identifier" in str(exc_lic.value)

    # Missing clinical action on approval must fail
    with pytest.raises(ValueError) as exc2:
        temp_pipeline.stage_6_clinician_review(
            staged_rule_id=staged_id,
            reviewer_name="Dr. Test",
            reviewer_license="DOC-1234",
            decision="APPROVED",
            clinical_action="",
            review_notes=""
        )
    assert "explicit actionable clinical action directive" in str(exc2.value)


def test_stage_7_duplicate_rule_prevention(temp_pipeline):
    # Production store already has aspirin + warfarin (RUL-INT-001)
    dup_rule = {
        "drug_a": "warfarin",  # Reversed order
        "drug_b": "aspirin",
        "severity": "major",
        "finding": "Bleeding duplicate",
        "verbatim_passage": "Verbatim text",
        "source_provenance": {"source_id": "DailyMed", "source_document_id": "Warfarin", "source_setid": "set2", "source_section": "Sec7", "source_url": "url"}
    }
    staged = temp_pipeline.stage_5_stage_rule(dup_rule)
    staged_id = staged["staged_rule_id"]

    temp_pipeline.stage_6_clinician_review(
        staged_rule_id=staged_id,
        reviewer_name="Dr. Test",
        reviewer_license="DOC-1234",
        decision="APPROVED",
        clinical_action="Avoid concomitant therapy.",
        review_notes="Approved duplicate"
    )

    # Duplicate publication must fail
    with pytest.raises(ValueError) as exc:
        temp_pipeline.stage_7_publish(staged_id)
    assert "already exists in production" in str(exc.value)


def test_stage_6_unauthorized_role_rejection(temp_pipeline):
    rule = {
        "drug_a": "drugx",
        "drug_b": "drugy",
        "severity": "major",
        "finding": "Test finding",
        "verbatim_passage": "Verbatim passage",
        "source_provenance": {"source_id": "Test", "source_document_id": "TestDoc", "source_setid": "set1", "source_section": "Sec"}
    }
    staged = temp_pipeline.stage_5_stage_rule(rule)
    staged_id = staged["staged_rule_id"]

    # Unauthorized roles must fail with PermissionError
    for unauth_role in ["INTERN", "PATIENT", "GUEST", "DATA_SCIENTIST"]:
        with pytest.raises(PermissionError) as exc:
            temp_pipeline.stage_6_clinician_review(
                staged_rule_id=staged_id,
                reviewer_name="John Doe",
                reviewer_license="DOC-MH-9999",
                reviewer_role=unauth_role,
                decision="APPROVED",
                clinical_action="Avoid concomitant therapy under all circumstances.",
                review_notes="Attempted unauth review"
            )
        assert f"Unauthorized reviewer role '{unauth_role}'" in str(exc.value)


def test_stage_7_tampered_audit_record_rejection(temp_pipeline):
    rule = {
        "drug_a": "ciprofloxacin",
        "drug_b": "theophylline",
        "severity": "major",
        "finding": "Inhibits clearance",
        "verbatim_passage": "Avoid concomitant use",
        "source_provenance": {"source_id": "DailyMed", "source_document_id": "Cipro", "source_setid": "set4", "source_section": "Sec7", "source_url": "url"}
    }
    staged = temp_pipeline.stage_5_stage_rule(rule)
    staged_id = staged["staged_rule_id"]

    temp_pipeline.stage_6_clinician_review(
        staged_rule_id=staged_id,
        reviewer_name="Dr. Valid",
        reviewer_license="DOC-MH-8888",
        decision="APPROVED",
        clinical_action="Dose adjustment required under serial blood level monitoring.",
        review_notes="Valid sign-off"
    )

    # Malicious tampering: altering finding text or clinical action directly in staging file
    staging_data = temp_pipeline._read_staging()
    for r in staging_data["staged_rules"]:
        if r["staged_rule_id"] == staged_id:
            r["clinical_action"] = "Tampered action: Co-administration is completely fine!"
            break
    temp_pipeline._write_staging(staging_data)

    # Attempting to publish tampered rule must fail cryptographic signature check
    with pytest.raises(PermissionError) as exc:
        temp_pipeline.stage_7_publish(staged_id)
    assert "Cryptographic audit signature mismatch. Tampered review record detected." in str(exc.value)


def test_missing_and_empty_audit_secret_fails_closed(tmp_path, monkeypatch):
    monkeypatch.delenv("INGESTION_AUDIT_SECRET", raising=False)
    staging_file = tmp_path / "staged.json"
    prod_file = tmp_path / "prod.json"

    # Test 1: Completely missing secret
    pipeline_no_sec = ClinicalKnowledgeIngestionPipeline(
        staging_path=staging_file,
        production_path=prod_file,
        audit_secret=None
    )
    rule = {
        "drug_a": "ciprofloxacin",
        "drug_b": "theophylline",
        "severity": "major",
        "finding": "Inhibits clearance",
        "verbatim_passage": "Avoid concomitant use",
        "source_provenance": {"source_id": "DailyMed", "source_document_id": "Cipro", "source_setid": "set4", "source_section": "Sec7", "source_url": "url"}
    }
    staged = pipeline_no_sec.stage_5_stage_rule(rule)
    staged_id = staged["staged_rule_id"]

    with pytest.raises(PermissionError) as exc1:
        pipeline_no_sec.stage_6_clinician_review(
            staged_rule_id=staged_id,
            reviewer_name="Dr. Valid",
            reviewer_license="DOC-MH-8888",
            decision="APPROVED",
            clinical_action="Dose adjustment required under serial blood level monitoring.",
            review_notes="Valid sign-off"
        )
    assert "INGESTION_AUDIT_SECRET is missing or empty" in str(exc1.value)

    # Test 2: Explicit empty string
    pipeline_empty_sec = ClinicalKnowledgeIngestionPipeline(
        staging_path=staging_file,
        production_path=prod_file,
        audit_secret="   "
    )
    with pytest.raises(PermissionError) as exc2:
        pipeline_empty_sec.stage_6_clinician_review(
            staged_rule_id=staged_id,
            reviewer_name="Dr. Valid",
            reviewer_license="DOC-MH-8888",
            decision="APPROVED",
            clinical_action="Dose adjustment required under serial blood level monitoring.",
            review_notes="Valid sign-off"
        )
    assert "INGESTION_AUDIT_SECRET is missing or empty" in str(exc2.value)


def test_secret_rotation_fails_closed(tmp_path):
    staging_file = tmp_path / "staged.json"
    prod_file = tmp_path / "prod.json"

    # Reviewed under Secret A
    pipeline_a = ClinicalKnowledgeIngestionPipeline(
        staging_path=staging_file,
        production_path=prod_file,
        audit_secret="SECRET_KEY_A_99999"
    )
    rule = {
        "drug_a": "ciprofloxacin",
        "drug_b": "theophylline",
        "severity": "major",
        "finding": "Inhibits clearance",
        "verbatim_passage": "Avoid concomitant use",
        "source_provenance": {"source_id": "DailyMed", "source_document_id": "Cipro", "source_setid": "set4", "source_section": "Sec7", "source_url": "url"}
    }
    staged = pipeline_a.stage_5_stage_rule(rule)
    staged_id = staged["staged_rule_id"]

    pipeline_a.stage_6_clinician_review(
        staged_rule_id=staged_id,
        reviewer_name="Dr. Valid",
        reviewer_license="DOC-MH-8888",
        decision="APPROVED",
        clinical_action="Dose adjustment required under serial blood level monitoring.",
        review_notes="Valid sign-off under Secret A"
    )

    # Attempt publish under Secret B (rotated/different key)
    pipeline_b = ClinicalKnowledgeIngestionPipeline(
        staging_path=staging_file,
        production_path=prod_file,
        audit_secret="SECRET_KEY_B_88888"
    )
    with pytest.raises(PermissionError) as exc:
        pipeline_b.stage_7_publish(staged_id)
    assert "Cryptographic audit signature mismatch" in str(exc.value)


def test_secret_not_leaked_in_staged_or_production_records(tmp_path):
    staging_file = tmp_path / "staged.json"
    prod_file = tmp_path / "prod.json"
    secret_value = "SUPER_SECRET_VALUE_DO_NOT_LEAK_12345"

    pipeline = ClinicalKnowledgeIngestionPipeline(
        staging_path=staging_file,
        production_path=prod_file,
        audit_secret=secret_value
    )
    rule = {
        "drug_a": "ciprofloxacin",
        "drug_b": "theophylline",
        "severity": "major",
        "finding": "Inhibits clearance",
        "verbatim_passage": "Avoid concomitant use",
        "source_provenance": {"source_id": "DailyMed", "source_document_id": "Cipro", "source_setid": "set4", "source_section": "Sec7", "source_url": "url"}
    }
    staged = pipeline.stage_5_stage_rule(rule)
    staged_id = staged["staged_rule_id"]

    pipeline.stage_6_clinician_review(
        staged_rule_id=staged_id,
        reviewer_name="Dr. Valid",
        reviewer_license="DOC-MH-8888",
        decision="APPROVED",
        clinical_action="Dose adjustment required under serial blood level monitoring.",
        review_notes="Valid sign-off"
    )
    pipeline.stage_7_publish(staged_id)

    # Verify secret is never written to staging or production JSON
    staged_content = staging_file.read_text(encoding="utf-8")
    prod_content = prod_file.read_text(encoding="utf-8")
    assert secret_value not in staged_content
    assert secret_value not in prod_content
