"""
MedlinePlus Source Adapter.
Parses official MedlinePlus Health Topics and disease summaries into canonical KnowledgeDocument objects.
"""
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

from rag_module.knowledge.document_model import KnowledgeDocument, DocumentType, EvidenceRole, ProvenanceStatus
from rag_module.ingestion.base_adapter import BaseSourceAdapter


class MedlinePlusAdapter(BaseSourceAdapter):
    """
    Adapter for MedlinePlus (NLM / NIH) Health Topics and Clinical Reference material.
    """
    def __init__(
        self,
        source_id: str = "MedlinePlus",
        source_name: str = "MedlinePlus Health Topics (NLM / NIH)",
        publisher: str = "National Library of Medicine (NLM/NIH)",
        base_url: str = "https://medlineplus.gov",
        data_source: Optional[Any] = None
    ):
        super().__init__(
            source_id=source_id,
            source_name=source_name,
            publisher=publisher,
            base_url=base_url
        )
        self.data_source = data_source

    def load_raw_data(self) -> Any:
        if self.data_source is None:
            default_path = Path("data/knowledge_bases/medlineplus/medlineplus_topics.json")
            if default_path.exists():
                with open(default_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            return []
        if isinstance(self.data_source, list):
            return self.data_source
        if isinstance(self.data_source, (str, Path)):
            p = Path(self.data_source)
            if p.is_file() and p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
        return []

    def parse_and_normalize(self, raw_data: Union[List[Dict[str, Any]], Dict[str, Any]]) -> List[KnowledgeDocument]:
        if isinstance(raw_data, dict):
            raw_data = raw_data.get("topics", raw_data.get("results", [raw_data]))

        if not isinstance(raw_data, list):
            return []

        documents = []
        for item in raw_data:
            if not isinstance(item, dict):
                self.stats["documents_rejected"] += 1
                continue

            topic_id = item.get("topic_id") or item.get("id") or "mplus_topic"
            title = item.get("title") or item.get("topic_name", "Medical Health Topic")
            domain = item.get("medical_domain", "general_medicine")
            url = item.get("url") or f"https://medlineplus.gov/{topic_id}.html"
            sections = item.get("sections", {})
            full_summary = item.get("summary") or item.get("content", "")

            if isinstance(sections, dict) and sections:
                for sec_name, sec_text in sections.items():
                    if not sec_text or len(str(sec_text).strip()) < 15:
                        continue
                    sec_id = re.sub(r'[^a-zA-Z0-9_]', '_', sec_name.lower()).strip('_')
                    doc = KnowledgeDocument(
                        document_id=f"mplus_{topic_id}_{sec_id}",
                        source_id=self.source_id,
                        source_name=self.source_name,
                        publisher=self.publisher,
                        title=f"{title} - {sec_name}",
                        content=f"Topic: {title}\nSection: {sec_name}\nPublisher: {self.publisher}\n\n{str(sec_text).strip()}",
                        source_url=url,
                        document_type=DocumentType.DISEASE_SUMMARY,
                        evidence_role=EvidenceRole.REFERENCE_SUMMARY,
                        provenance_status=ProvenanceStatus.VERIFIED,
                        medical_domain=domain,
                        section=sec_name,
                        section_id=sec_id,
                        parent_document_id=f"mplus_{topic_id}",
                        entities=item.get("mesh_terms", [title]),
                        version="2.9",
                        metadata={
                            "topic_id": topic_id,
                            "topic_name": title,
                            "section_name": sec_name,
                            "mesh_terms": item.get("mesh_terms", [])
                        }
                    )
                    documents.append(doc)
            elif full_summary and len(full_summary.strip()) >= 15:
                doc = KnowledgeDocument(
                    document_id=f"mplus_{topic_id}",
                    source_id=self.source_id,
                    source_name=self.source_name,
                    publisher=self.publisher,
                    title=title,
                    content=f"Topic: {title}\nPublisher: {self.publisher}\n\n{full_summary.strip()}",
                    source_url=url,
                    document_type=DocumentType.DISEASE_SUMMARY,
                    evidence_role=EvidenceRole.REFERENCE_SUMMARY,
                    provenance_status=ProvenanceStatus.VERIFIED,
                    medical_domain=domain,
                    section="Summary",
                    section_id="summary",
                    entities=item.get("mesh_terms", [title]),
                    version="2.9",
                    metadata={
                        "topic_id": topic_id,
                        "topic_name": title,
                        "mesh_terms": item.get("mesh_terms", [])
                    }
                )
                documents.append(doc)

        return documents
