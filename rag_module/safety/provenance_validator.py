"""
Provenance Validation Engine (V2.8).
Provides deterministic verification of evidence metadata, traceability, and publisher authenticity.
Ensures that no fabricated or partially-identified evidence reaches downstream context or generation.
"""
from enum import Enum
from typing import List, Dict, Any, Optional
import re
from pydantic import BaseModel, Field, ConfigDict


class ProvenanceStatus(str, Enum):
    VALID = "valid"
    PARTIALLY_IDENTIFIED = "partially_identified"
    INVALID = "invalid"


class ProvenanceValidationResult(BaseModel):
    """
    Structured outcome of an evidence provenance audit.
    """
    status: ProvenanceStatus = Field(..., description="Overall provenance validity status.")
    is_valid: bool = Field(..., description="True if provenance is fully valid and auditable.")
    missing_fields: List[str] = Field(default_factory=list, description="List of missing required metadata fields.")
    warnings: List[str] = Field(default_factory=list, description="Non-fatal metadata quality warnings.")
    source_id: str = Field(default="unknown", description="Source identifier if identified.")
    document_id: str = Field(default="", description="Canonical document ID if identified.")
    chunk_id: str = Field(default="", description="Unique chunk ID if identified.")

    model_config = ConfigDict(extra="forbid")


class ProvenanceValidator:
    """
    Audits EvidenceItem and raw chunk dictionaries against strict clinical provenance standards.
    """
    MANDATORY_FIELDS = [
        "source_id",
        "source_name",
        "publisher",
        "document_id",
        "chunk_id",
        "title",
        "section",
        "medical_domain",
        "text"
    ]

    URL_REGEX = re.compile(
        r'^(https?:\/\/)?'  # optional scheme
        r'([a-zA-Z0-9_-]+\.)+[a-zA-Z]{2,}'  # domain
        r'(:\d+)?(\/.*)?$',  # optional port and path
        re.IGNORECASE
    )

    KNOWN_AUTHORITATIVE_SOURCES = {
        "dailymed",
        "medquad_nih",
        "medquad",
        "medlineplus",
        "icmr",
        "mohfw_stg",
        "mohfw",
        "rxnorm",
        "openfda",
        "who_guidelines",
        "clinicalguidelines",
        "cancergov",
        "niddk",
        "cdc",
        "gard",
        "ninds",
        "nhlbi",
        "ghr",
        "seniorhealth"
    }

    @classmethod
    def validate_evidence_item(cls, item: Any) -> ProvenanceValidationResult:
        """
        Validates an EvidenceItem or dictionary for complete clinical provenance.
        """
        if isinstance(item, dict):
            data = item
        elif hasattr(item, "model_dump"):
            data = item.model_dump()
        elif hasattr(item, "__dict__"):
            data = item.__dict__
        else:
            return ProvenanceValidationResult(
                status=ProvenanceStatus.INVALID,
                is_valid=False,
                missing_fields=cls.MANDATORY_FIELDS,
                warnings=["Unsupported evidence object type."]
            )

        missing = []
        warnings = []

        # Check mandatory fields
        for field in cls.MANDATORY_FIELDS:
            val = data.get(field)
            if val is None or str(val).strip() == "" or str(val).strip().lower() in ["unknown", "none", "null"]:
                # Special allowance for title/section if fallback present
                if field in ["title", "section"] and (data.get("focus") or data.get("qtype")):
                    continue
                missing.append(field)

        # Check text length
        text_val = str(data.get("text", "")).strip()
        if len(text_val) < 15 or len(text_val.split()) < 3:
            missing.append("meaningful_text_content")

        # Check URL validity if present
        url_val = str(data.get("source_url") or data.get("url") or "").strip()
        if url_val and not (url_val.startswith("http://") or url_val.startswith("https://")):
            warnings.append(f"Source URL '{url_val}' lacks valid http/https protocol scheme.")

        # Check source registry recognition
        source_id = str(data.get("source_id", "")).strip().lower()
        if source_id and source_id not in cls.KNOWN_AUTHORITATIVE_SOURCES:
            missing.append("source_id_unrecognized")
            warnings.append(f"Source ID '{source_id}' is not in the canonical registry of known clinical sources.")

        # Determine provenance status
        if missing:
            # If only 1-2 non-critical fields missing, classify as partially identified
            if set(missing).issubset({"publisher", "section", "medical_domain", "title"}):
                status = ProvenanceStatus.PARTIALLY_IDENTIFIED
                is_valid = False
            else:
                status = ProvenanceStatus.INVALID
                is_valid = False
        else:
            status = ProvenanceStatus.VALID
            is_valid = True

        return ProvenanceValidationResult(
            status=status,
            is_valid=is_valid,
            missing_fields=missing,
            warnings=warnings,
            source_id=str(data.get("source_id", "unknown")),
            document_id=str(data.get("document_id", "")),
            chunk_id=str(data.get("chunk_id", ""))
        )
