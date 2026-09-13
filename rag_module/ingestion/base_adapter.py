"""
Base Source Adapter Interface for Medical Knowledge Sources.
All knowledge source loaders implement this protocol to normalize
raw data into canonical KnowledgeDocument objects.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path

from rag_module.knowledge.document_model import KnowledgeDocument, compute_sha256


class BaseSourceAdapter(ABC):
    """
    Abstract interface for knowledge source adapters.
    Responsible for:
    1. Loading raw source data
    2. Parsing source-specific structures
    3. Normalizing into KnowledgeDocument objects
    4. Validating document integrity
    5. Deduplicating by content hash
    """
    def __init__(
        self,
        source_id: str = "custom_source",
        source_name: str = "Custom Knowledge Source",
        publisher: str = "Medical Publisher",
        base_url: str = ""
    ):
        self.source_id = source_id
        self.source_name = source_name
        self.publisher = publisher
        self.base_url = base_url
        self.stats: Dict[str, Any] = {
            "documents_seen": 0,
            "documents_valid": 0,
            "documents_rejected": 0,
            "duplicates_removed": 0
        }

    @abstractmethod
    def load_raw_data(self) -> Any:
        """Loads raw data from disk, API, or files."""
        pass

    @abstractmethod
    def parse_and_normalize(self, raw_data: Any) -> List[KnowledgeDocument]:
        """Parses raw source data into canonical KnowledgeDocument instances."""
        pass

    def validate_document(self, doc: KnowledgeDocument) -> Tuple[bool, Optional[str]]:
        """Validates a document. Subclasses can override for source-specific rules."""
        return doc.validate()

    def deduplicate(self, documents: List[KnowledgeDocument]) -> List[KnowledgeDocument]:
        """Deduplicates documents using deterministic SHA-256 content hashes."""
        seen_hashes = set()
        unique_docs = []
        for doc in documents:
            if not doc.content_hash:
                doc.content_hash = compute_sha256(doc.content)
            
            if doc.content_hash in seen_hashes:
                self.stats["duplicates_removed"] += 1
                continue
            
            seen_hashes.add(doc.content_hash)
            unique_docs.append(doc)
        return unique_docs

    def run(self, raw_data: Optional[Any] = None) -> Tuple[List[KnowledgeDocument], Dict[str, Any]]:
        """
        Executes full source ingestion workflow:
        Load -> Parse/Normalize -> Validate -> Deduplicate.
        Returns (documents, stats).
        """
        if raw_data is None:
            raw_data = self.load_raw_data()
        raw_documents = self.parse_and_normalize(raw_data)
        self.stats["documents_seen"] = len(raw_documents)

        valid_documents = []
        for doc in raw_documents:
            is_valid, error = self.validate_document(doc)
            if is_valid:
                valid_documents.append(doc)
                self.stats["documents_valid"] += 1
            else:
                self.stats["documents_rejected"] += 1

        deduped_documents = self.deduplicate(valid_documents)
        return deduped_documents, self.get_statistics()

    def get_statistics(self) -> Dict[str, Any]:
        """Returns ingestion metrics."""
        return {
            "source_id": self.source_id,
            "source_name": self.source_name,
            **self.stats
        }
