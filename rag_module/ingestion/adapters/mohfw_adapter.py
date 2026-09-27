"""
MoHFW Standard Treatment Guidelines (STG) Source Adapter.
Parses official Ministry of Health and Family Welfare Standard Treatment Guidelines into canonical KnowledgeDocument objects.
"""
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

from rag_module.knowledge.document_model import KnowledgeDocument, DocumentType, EvidenceRole, ProvenanceStatus
from rag_module.ingestion.base_adapter import BaseSourceAdapter


class MoHFWAdapter(BaseSourceAdapter):
    """
    Adapter for MoHFW Standard Treatment Guidelines under the Clinical Establishments Act.
    """
    def __init__(
        self,
        source_id: str = "MoHFW_STG",
        source_name: str = "Ministry of Health & Family Welfare Standard Treatment Guidelines",
        publisher: str = "Ministry of Health and Family Welfare (Govt of India)",
        base_url: str = "https://clinicalestablishments.gov.in",
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
            default_path = Path("data/knowledge_bases/mohfw_stg/mohfw_stgs.json")
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
            raw_data = raw_data.get("stgs", raw_data.get("results", [raw_data]))

        if not isinstance(raw_data, list):
            return []

        documents = []
        for item in raw_data:
            if not isinstance(item, dict):
                self.stats["documents_rejected"] += 1
                continue

            stg_id = item.get("stg_id") or item.get("id", "mohfw_stg")
            stg_title = item.get("title") or item.get("stg_title", "Standard Treatment Guideline")
            care_level = item.get("care_level", "Primary and Secondary Care")
            domain = item.get("medical_domain", "primary_care")
            url = item.get("url") or f"https://clinicalestablishments.gov.in/stg/{stg_id}"
            sections = item.get("sections", [])

            if isinstance(sections, list) and sections:
                for sec in sections:
                    sec_title = sec.get("section_title") or sec.get("heading", "Clinical Management")
                    sec_content = sec.get("content") or sec.get("text", "")
                    page_num = sec.get("page_number")
                    sec_id_val = sec.get("section_id") or re.sub(r'[^a-zA-Z0-9_]', '_', sec_title.lower()).strip('_')

                    if not sec_content or len(str(sec_content).strip()) < 15:
                        continue

                    page_str = f"Page {page_num}" if page_num else "Standard Section"
                    doc = KnowledgeDocument(
                        document_id=f"mohfw_{stg_id}_{sec_id_val}",
                        source_id=self.source_id,
                        source_name=self.source_name,
                        publisher=self.publisher,
                        title=f"{stg_title} - {sec_title}",
                        content=f"MoHFW Standard Treatment Guideline: {stg_title}\nFacility Level: {care_level}\nSection: {sec_title} ({page_str})\nPublisher: {self.publisher}\n\n{str(sec_content).strip()}",
                        source_url=url,
                        document_type=DocumentType.CLINICAL_GUIDELINE,
                        evidence_role=EvidenceRole.CLINICAL_GUIDELINE,
                        provenance_status=ProvenanceStatus.VERIFIED,
                        medical_domain=domain,
                        section=sec_title,
                        section_id=sec_id_val,
                        parent_document_id=f"mohfw_{stg_id}",
                        page_number=page_num,
                        entities=item.get("target_conditions", [stg_title]),
                        version="2.9",
                        metadata={
                            "stg_id": stg_id,
                            "stg_title": stg_title,
                            "care_level": care_level,
                            "section_title": sec_title,
                            "page_number": page_num,
                            "target_conditions": item.get("target_conditions", [])
                        }
                    )
                    documents.append(doc)
            elif item.get("content") and len(item.get("content", "").strip()) >= 15:
                doc = KnowledgeDocument(
                    document_id=f"mohfw_{stg_id}",
                    source_id=self.source_id,
                    source_name=self.source_name,
                    publisher=self.publisher,
                    title=stg_title,
                    content=f"MoHFW Standard Treatment Guideline: {stg_title}\nFacility Level: {care_level}\nPublisher: {self.publisher}\n\n{item['content'].strip()}",
                    source_url=url,
                    document_type=DocumentType.CLINICAL_GUIDELINE,
                    evidence_role=EvidenceRole.CLINICAL_GUIDELINE,
                    provenance_status=ProvenanceStatus.VERIFIED,
                    medical_domain=domain,
                    section="Complete STG",
                    section_id="complete_stg",
                    entities=item.get("target_conditions", [stg_title]),
                    version="2.9",
                    metadata={
                        "stg_id": stg_id,
                        "stg_title": stg_title,
                        "care_level": care_level
                    }
                )
                documents.append(doc)

        return documents
