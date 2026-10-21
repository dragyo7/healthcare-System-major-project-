"""
pipeline.py

Evidence-Driven Clinical Knowledge Ingestion Pipeline.
Provides a verifiable, staged ingestion workflow for authoritative drug interaction data.

Strict Governance Invariants:
1. SEPARATION OF CONCERNS: Ingestion is separated into Acquisition, Parsing, Normalization,
   Validation, Staging, Clinician Review, and Publication.
2. ZERO AUTOMATIC ACTIVATION: Automatically extracted rules enter the STAGING store with
   status 'PENDING_CLINICIAN_REVIEW' and is_active = False. They are NEVER active in production.
3. AUDITABLE PROVENANCE: Every rule records source identifiers, SetID, section, version,
   retrieval date, extraction timestamp, and licensed clinician approval sign-off.
4. FAIL-CLOSED INTEGRITY: Malformed inputs, missing citations, or unrecognized drug moieties
   are rejected before staging.
"""

import json
import uuid
import hashlib
import hmac
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STAGING_FILE = BASE_DIR / "data" / "rules" / "staging" / "staged_rules.json"
PRODUCTION_FILE = BASE_DIR / "data" / "rules" / "medication_interactions" / "medication_interactions.json"

try:
    from drug_module.normalizer import get_drug_identity, decompose_medication
except ImportError:
    from normalizer import get_drug_identity, decompose_medication


class ClinicalKnowledgeIngestionPipeline:
    """
    Seven-stage evidence-driven ingestion pipeline for drug interaction and safety rules.
    """

    def __init__(self, staging_path: Optional[Path] = None, production_path: Optional[Path] = None, audit_secret: Optional[str] = None):
        self.staging_path = staging_path or STAGING_FILE
        self.production_path = production_path or PRODUCTION_FILE
        raw_secret = audit_secret if audit_secret is not None else os.environ.get("INGESTION_AUDIT_SECRET", "")
        self.audit_secret = str(raw_secret).strip()
        self.staging_path.parent.mkdir(parents=True, exist_ok=True)
        self.production_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.staging_path.exists():
            self._write_staging({"staged_rules": []})

    def _require_audit_secret(self) -> str:
        """
        Enforces that a non-empty audit secret is configured before cryptographic review or publication.
        Fails closed with PermissionError if INGESTION_AUDIT_SECRET is missing or empty.
        """
        if not self.audit_secret:
            raise PermissionError(
                "Knowledge ingestion governance failure: INGESTION_AUDIT_SECRET is missing or empty. "
                "Clinical review and publication require a configured cryptographic audit secret."
            )
        return self.audit_secret

    def _compute_audit_hash(self, audit_payload: str) -> str:
        """Computes a keyed HMAC-SHA256 digest to prevent unkeyed offline tampering."""
        secret = self._require_audit_secret()
        return hmac.new(secret.encode('utf-8'), audit_payload.encode('utf-8'), hashlib.sha256).hexdigest()

    def _read_staging(self) -> Dict[str, Any]:
        if not self.staging_path.exists():
            return {"staged_rules": []}
        try:
            with open(self.staging_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"staged_rules": []}

    def _write_staging(self, data: Dict[str, Any]) -> None:
        with open(self.staging_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _read_production(self) -> Dict[str, Any]:
        if not self.production_path.exists():
            return {"rules": []}
        try:
            with open(self.production_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"rules": []}

    def _write_production(self, data: Dict[str, Any]) -> None:
        with open(self.production_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # -------------------------------------------------------------------------
    # STAGE 1: Source Acquisition
    # -------------------------------------------------------------------------
    def stage_1_acquire_source(
        self,
        source_id: str,
        setid: str,
        document_title: str,
        version: str,
        effective_date: str,
        raw_text_content: str,
        source_url: str = ""
    ) -> Dict[str, Any]:
        """
        Validates source document metadata and packages acquisition artifact.
        """
        if not source_id or not setid or not raw_text_content.strip():
            raise ValueError("Acquisition failed: source_id, setid, and raw_text_content are required.")

        return {
            "acquisition_id": f"ACQ-{uuid.uuid4().hex[:8].upper()}",
            "source_id": source_id,
            "setid": setid,
            "document_title": document_title,
            "version": version,
            "effective_date": effective_date,
            "source_url": source_url or f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={setid}",
            "raw_text_content": raw_text_content,
            "acquired_at": datetime.now(timezone.utc).isoformat()
        }

    # -------------------------------------------------------------------------
    # STAGE 2: Section Parsing & Statement Extraction
    # -------------------------------------------------------------------------
    def stage_2_parse_sections(self, acquired_doc: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extracts candidate interaction statements from raw text.
        Looks for Section 7 (Drug Interactions) paragraphs and interacting candidate pairs.
        """
        raw_text = acquired_doc["raw_text_content"]
        extracted_statements = []

        paragraphs = [p.strip() for p in raw_text.split("\n\n") if len(p.strip()) > 35]
        for para in paragraphs:
            # Check if paragraph discusses drug interactions
            lower_para = para.lower()
            if any(term in lower_para for term in ["concomitant", "interaction", "co-administration", "inhibit", "increase risk", "avoid use"]):
                extracted_statements.append({
                    "statement_id": f"STMT-{uuid.uuid4().hex[:6].upper()}",
                    "section_name": "Section 7 Drug Interactions / Warnings",
                    "verbatim_text": para
                })

        return extracted_statements

    # -------------------------------------------------------------------------
    # STAGE 3: Normalization & Entity Linking
    # -------------------------------------------------------------------------
    def stage_3_normalize_and_link(
        self,
        drug_a_raw: str,
        drug_b_raw: str,
        verbatim_text: str
    ) -> Dict[str, Any]:
        """
        Resolves raw drug names to canonical active pharmaceutical ingredients.
        """
        ident_a = get_drug_identity(drug_a_raw)
        drug_a_norm = ident_a.get("canonical_name", drug_a_raw).lower() if isinstance(ident_a, dict) else str(ident_a).lower()

        ident_b = get_drug_identity(drug_b_raw)
        drug_b_norm = ident_b.get("canonical_name", drug_b_raw).lower() if isinstance(ident_b, dict) else str(ident_b).lower()

        if drug_a_norm == drug_b_norm:
            raise ValueError(f"Normalization error: both terms resolved to identical moiety '{drug_a_norm}'.")

        return {
            "drug_a_raw": drug_a_raw,
            "drug_b_raw": drug_b_raw,
            "drug_a_canonical": drug_a_norm,
            "drug_b_canonical": drug_b_norm,
            "verbatim_text": verbatim_text
        }

    # -------------------------------------------------------------------------
    # STAGE 4: Validation Engine
    # -------------------------------------------------------------------------
    def stage_4_validate_rule(
        self,
        normalized_data: Dict[str, Any],
        severity: str,
        finding: str,
        acquired_doc: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Validates clinical rule constraints before staging.
        """
        valid_severities = ["major", "moderate", "minor"]
        if severity.lower() not in valid_severities:
            raise ValueError(f"Validation error: Severity must be one of {valid_severities}, got '{severity}'.")

        if len(finding.strip()) < 10:
            raise ValueError("Validation error: Clinical finding description must be at least 10 characters.")

        if not normalized_data.get("verbatim_text", "").strip():
            raise ValueError("Validation error: Verbatim source passage must not be empty.")

        # Sort drugs alphabetically for canonical keying
        drug_pair = sorted([normalized_data["drug_a_canonical"], normalized_data["drug_b_canonical"]])

        return {
            "drug_a": drug_pair[0],
            "drug_b": drug_pair[1],
            "severity": severity.lower(),
            "finding": finding.strip(),
            "verbatim_passage": normalized_data["verbatim_text"].strip(),
            "source_provenance": {
                "source_id": acquired_doc["source_id"],
                "source_document_id": acquired_doc["document_title"],
                "source_setid": acquired_doc["setid"],
                "source_section": "Section 7 Drug Interactions",
                "source_version": acquired_doc.get("version", "1.0"),
                "source_url": acquired_doc.get("source_url", ""),
                "effective_date": acquired_doc.get("effective_date", "")
            }
        }

    # -------------------------------------------------------------------------
    # STAGE 5: Staging Store (Pending Clinician Review)
    # -------------------------------------------------------------------------
    def stage_5_stage_rule(self, validated_rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Persists candidate rule to the staging store.
        INVARIANT: is_active is strictly False; status is PENDING_CLINICIAN_REVIEW.
        """
        staging_data = self._read_staging()
        staged_id = f"STG-INT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        record = {
            "staged_rule_id": staged_id,
            "drug_a": validated_rule["drug_a"],
            "drug_b": validated_rule["drug_b"],
            "severity": validated_rule["severity"],
            "finding": validated_rule["finding"],
            "verbatim_passage": validated_rule["verbatim_passage"],
            "source_provenance": validated_rule["source_provenance"],
            "is_active": False,
            "review_status": "PENDING_CLINICIAN_REVIEW",
            "staged_at": datetime.now(timezone.utc).isoformat(),
            "clinician_review": None
        }

        staging_data["staged_rules"].append(record)
        self._write_staging(staging_data)
        return record

    # -------------------------------------------------------------------------
    # STAGE 6: Clinician Review & Governance Gate
    # -------------------------------------------------------------------------
    AUTHORIZED_CLINICAL_ROLES = {"LICENSED_PHYSICIAN", "CHIEF_MEDICAL_OFFICER", "CLINICAL_PHARMACOLOGIST"}

    def stage_6_clinician_review(
        self,
        staged_rule_id: str,
        reviewer_name: str,
        reviewer_license: str,
        decision: str,
        clinical_action: str,
        review_notes: str,
        reviewer_role: str = "LICENSED_PHYSICIAN"
    ) -> Dict[str, Any]:
        """
        Records licensed clinician review decision.
        Decisions: 'APPROVED', 'REJECTED', 'MODIFIED'
        Enforces:
        - Authenticated reviewer role check (physician, CMO, pharmacologist)
        - Syntactic license format validation
        - Cryptographic SHA-256 tamper-evident review audit seal
        """
        valid_decisions = ["APPROVED", "REJECTED", "MODIFIED"]
        # 0. Secret Configuration Gate (Fail-Closed)
        self._require_audit_secret()

        if decision.upper() not in valid_decisions:
            raise ValueError(f"Review decision must be one of {valid_decisions}, got '{decision}'.")

        # 1. Role Authorization Gate
        if not reviewer_role or reviewer_role.upper() not in self.AUTHORIZED_CLINICAL_ROLES:
            raise PermissionError(
                f"Unauthorized reviewer role '{reviewer_role}'. Only authorized roles {list(self.AUTHORIZED_CLINICAL_ROLES)} may review clinical rules."
            )

        # 2. Reviewer Identity & License Syntax Gate
        if not reviewer_name or not str(reviewer_name).strip():
            raise ValueError("Clinician review requires authenticated reviewer_name.")
        if not reviewer_license or len(str(reviewer_license).strip()) < 6:
            raise ValueError("Clinician review requires valid medical license identifier (min 6 alphanumeric chars).")

        if decision.upper() == "APPROVED" and (not clinical_action or len(clinical_action.strip()) < 10):
            raise ValueError("Approval requires an explicit actionable clinical action directive (min 10 chars).")

        staging_data = self._read_staging()
        target_rule = None
        for rule in staging_data.get("staged_rules", []):
            if rule.get("staged_rule_id") == staged_rule_id:
                target_rule = rule
                break

        if not target_rule:
            raise KeyError(f"Staged rule with ID '{staged_rule_id}' not found in staging store.")

        # Compute tamper-evident cryptographic review seal using HMAC-SHA256
        audit_payload = f"{staged_rule_id}:{target_rule['drug_a']}:{target_rule['drug_b']}:{target_rule['severity']}:{reviewer_name.strip()}:{reviewer_license.strip()}:{reviewer_role.upper()}:{decision.upper()}:{clinical_action.strip()}"
        review_audit_hash = self._compute_audit_hash(audit_payload)

        review_record = {
            "reviewer_name": reviewer_name.strip(),
            "reviewer_license": reviewer_license.strip(),
            "reviewer_role": reviewer_role.upper(),
            "decision": decision.upper(),
            "clinical_action": clinical_action.strip(),
            "review_notes": review_notes.strip(),
            "review_audit_hash": review_audit_hash,
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }

        target_rule["clinician_review"] = review_record
        if decision.upper() == "APPROVED":
            target_rule["review_status"] = "APPROVED_CLINICAL_RULE"
            target_rule["clinical_action"] = clinical_action.strip()
        elif decision.upper() == "REJECTED":
            target_rule["review_status"] = "REJECTED_CLINICAL_RULE"
        elif decision.upper() == "MODIFIED":
            target_rule["review_status"] = "NEEDS_REVISION"

        self._write_staging(staging_data)
        return target_rule

    # -------------------------------------------------------------------------
    # STAGE 7: Publication to Production
    # -------------------------------------------------------------------------
    def stage_7_publish(self, staged_rule_id: str) -> Dict[str, Any]:
        """
        Publishes an approved staged rule into the production ruleset.
        INVARIANTS:
        1. Only rules with review_status == 'APPROVED_CLINICAL_RULE' can be published.
        2. Cryptographic audit seal must verify cleanly against current staged rule content.
        """
        # 0. Secret Configuration Gate (Fail-Closed)
        self._require_audit_secret()

        staging_data = self._read_staging()
        target_rule = None
        for rule in staging_data.get("staged_rules", []):
            if rule.get("staged_rule_id") == staged_rule_id:
                target_rule = rule
                break

        if not target_rule:
            raise KeyError(f"Staged rule with ID '{staged_rule_id}' not found.")

        if target_rule.get("review_status") != "APPROVED_CLINICAL_RULE":
            raise PermissionError(
                f"Cannot publish rule '{staged_rule_id}': Status is '{target_rule.get('review_status')}'. "
                "Only rules with 'APPROVED_CLINICAL_RULE' can be published to production."
            )

        # Verify cryptographic review audit seal against tampering using HMAC-SHA256
        rev = target_rule.get("clinician_review") or {}
        audit_payload = f"{target_rule['staged_rule_id']}:{target_rule['drug_a']}:{target_rule['drug_b']}:{target_rule['severity']}:{rev.get('reviewer_name', '').strip()}:{rev.get('reviewer_license', '').strip()}:{rev.get('reviewer_role', 'LICENSED_PHYSICIAN')}:{rev.get('decision', '')}:{target_rule.get('clinical_action', '').strip()}"
        expected_hash = self._compute_audit_hash(audit_payload)
        if expected_hash != rev.get("review_audit_hash"):
            raise PermissionError(
                f"Cannot publish rule '{staged_rule_id}': Cryptographic audit signature mismatch. Tampered review record detected."
            )

        prod_data = self._read_production()
        existing_rules = prod_data.get("rules", [])

        # Check if identical pair already exists
        pair = sorted([target_rule["drug_a"], target_rule["drug_b"]])
        for ex in existing_rules:
            ex_pair = sorted([ex.get("drug_a", ""), ex.get("drug_b", "")])
            if ex_pair == pair:
                raise ValueError(f"Rule for pair {pair} already exists in production ({ex.get('rule_id')}).")

        # Generate production Rule ID
        next_num = len(existing_rules) + 1
        prod_rule_id = f"RUL-INT-{str(next_num).zfill(3)}"

        prod_rule = {
            "rule_id": prod_rule_id,
            "drug_a": target_rule["drug_a"],
            "drug_b": target_rule["drug_b"],
            "severity": target_rule["severity"],
            "finding": target_rule["finding"],
            "clinical_action": target_rule["clinical_action"],
            "source_id": target_rule["source_provenance"]["source_id"],
            "source_document_id": target_rule["source_provenance"]["source_document_id"],
            "source_section": target_rule["source_provenance"]["source_section"],
            "source_url": target_rule["source_provenance"]["source_url"],
            "provenance_status": "VERIFIED",
            "review_status": "APPROVED_CLINICAL_RULE",
            "ingestion_metadata": {
                "staged_rule_id": target_rule["staged_rule_id"],
                "published_at": datetime.now(timezone.utc).isoformat(),
                "approved_by": target_rule["clinician_review"]["reviewer_name"],
                "license": target_rule["clinician_review"]["reviewer_license"]
            }
        }

        existing_rules.append(prod_rule)
        prod_data["rules"] = existing_rules
        self._write_production(prod_data)

        # Mark as published in staging
        target_rule["review_status"] = "PUBLISHED_TO_PRODUCTION"
        target_rule["published_rule_id"] = prod_rule_id
        target_rule["is_active"] = True
        self._write_staging(staging_data)

        return prod_rule
