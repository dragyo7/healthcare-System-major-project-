"""
Canonical Knowledge Document and Chunk Models.
Provides strongly-typed, serializable, and source-agnostic data models
for all medical knowledge sources.
"""
import hashlib
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple


class DocumentType:
    """Standardized document type categories."""
    QA_PAIR = "qa_pair"
    DRUG_MONOGRAPH = "drug_monograph"
    CLINICAL_GUIDELINE = "clinical_guideline"
    CLINICAL_PRACTICE_GUIDELINE = "clinical_guideline"
    DISEASE_SUMMARY = "disease_summary"
    CLINICAL_SUMMARY = "clinical_summary"
    GENERAL_REFERENCE = "general_reference"


def compute_sha256(text: str) -> str:
    """Computes a deterministic SHA-256 hash of normalized text."""
    normalized = " ".join(text.strip().lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


@dataclass
class KnowledgeDocument:
    """
    Canonical representation of a medical knowledge document.
    All source adapters (MedQuAD, DailyMed, openFDA, Guidelines) normalize into this model.
    """
    document_id: str
    source_id: str
    source_name: str
    publisher: str
    title: str
    content: str
    source_url: str = ""
    document_type: str = DocumentType.GENERAL_REFERENCE  # "qa_pair", "drug_monograph", "clinical_guideline", "disease_summary"
    medical_domain: str = "general_medicine"  # "oncology", "pharmacology", "genetics", "cardiology", etc.
    section: Optional[str] = None             # "Indications", "Dosage", "Side Effects", "Symptoms", etc.
    entities: List[str] = field(default_factory=list) # Extracted clinical entities (drugs, diseases, genes)
    version: str = "2.3"
    retrieved_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    content_hash: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict) # Source-specific extension metadata

    def __post_init__(self):
        if not self.content_hash and self.content:
            self.content_hash = compute_sha256(self.content)

    def validate(self) -> Tuple[bool, Optional[str]]:
        """Validates document integrity. Returns (is_valid, error_reason)."""
        if not self.document_id or not self.document_id.strip():
            return False, "Missing document_id"
        if not self.source_id or not self.source_id.strip():
            return False, "Missing source_id"
        if not self.content or len(self.content.strip()) < 10:
            return False, "Document content is empty or under 10 characters (Content too short)"
        if not self.title or not self.title.strip():
            return False, "Missing document title"
        if self.source_url and not (self.source_url.startswith("http://") or self.source_url.startswith("https://")):
            return False, f"Invalid source_url: {self.source_url}"
        return True, None

    def to_dict(self) -> Dict[str, Any]:
        """Serializes document to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeDocument":
        """Deserializes dictionary into KnowledgeDocument instance."""
        data_copy = dict(data)
        # Handle backward compatibility fields from legacy MedQuAD clean_corpus_v2.json
        if "question" in data_copy and "answer" in data_copy and "content" not in data_copy:
            q = data_copy.get("question", "")
            a = data_copy.get("answer", "")
            data_copy["content"] = f"Question: {q}\nAnswer: {a}"
            data_copy["title"] = data_copy.get("focus") or q
            data_copy["document_type"] = "qa_pair"
            if "qid" in data_copy:
                data_copy.setdefault("metadata", {})["qid"] = data_copy["qid"]
            if "qtype" in data_copy:
                data_copy.setdefault("metadata", {})["qtype"] = data_copy["qtype"]
        
        # Filter keys to match dataclass fields
        valid_keys = {
            "document_id", "source_id", "source_name", "publisher", "title",
            "content", "source_url", "document_type", "medical_domain",
            "section", "entities", "version", "retrieved_at", "content_hash",
            "metadata"
        }
        filtered = {k: v for k, v in data_copy.items() if k in valid_keys}
        return cls(**filtered)


@dataclass
class KnowledgeChunk:
    """
    Canonical representation of an indexed retrieval passage.
    """
    chunk_id: str
    document_id: str
    source_id: str
    source_name: str
    publisher: str
    title: str
    text: str
    source_url: str = ""
    document_type: str = "general_reference"
    medical_domain: str = "general_medicine"
    section: Optional[str] = None
    chunk_index: int = 0
    word_count: int = 0
    char_count: int = 0
    content_hash: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.word_count and self.text:
            self.word_count = len(self.text.split())
        if not self.char_count and self.text:
            self.char_count = len(self.text)
        if not self.content_hash and self.text:
            self.content_hash = compute_sha256(self.text)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes chunk to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "KnowledgeChunk":
        """Deserializes dictionary into KnowledgeChunk instance."""
        valid_keys = {
            "chunk_id", "document_id", "source_id", "source_name", "publisher",
            "title", "text", "source_url", "document_type", "medical_domain",
            "section", "chunk_index", "word_count", "char_count", "content_hash",
            "metadata"
        }
        filtered = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered)
