"""
ICMR Source Adapter.
Parses authentic Indian Council of Medical Research (ICMR) clinical guidelines into canonical KnowledgeDocument objects.
"""
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

from rag_module.knowledge.document_model import KnowledgeDocument, DocumentType, EvidenceRole, ProvenanceStatus
from rag_module.ingestion.base_adapter import BaseSourceAdapter


class ICMRAdapter(BaseSourceAdapter):
    """
    Adapter for ICMR Clinical Guidelines and Indian National Health Protocols.
    """
    def __init__(
        self,
        source_id: str = "ICMR",
        source_name: str = "Indian Council of Medical Research Clinical Guidelines",
        publisher: str = "Indian Council of Medical Research (ICMR, Govt of India)",
        base_url: str = "https://main.icmr.nic.in",
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
            default_path = Path("data/knowledge_bases/icmr/icmr_guidelines.json")
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
            raw_data = raw_data.get("guidelines", raw_data.get("results", [raw_data]))

        if not isinstance(raw_data, list):
            return []

        documents = []
        for item in raw_data:
            if not isinstance(item, dict):
                self.stats["documents_rejected"] += 1
                continue

            guideline_id = item.get("guideline_id") or item.get("id", "icmr_gl")
            guideline_title = item.get("title") or item.get("guideline_title", "ICMR Clinical Guideline")
            year = item.get("publication_year") or item.get("year", "2023")
            domain = item.get("medical_domain", "evidence_based_medicine")
            url = item.get("url") or f"https://main.icmr.nic.in/content/{guideline_id}"
            sections = item.get("sections", [])

            if isinstance(sections, list) and sections:
                for sec in sections:
                    sec_title = sec.get("section_title") or sec.get("heading", "Recommendations")
                    sec_content = sec.get("content") or sec.get("text", "")
                    page_num = sec.get("page_number")
                    sec_id_val = sec.get("section_id") or re.sub(r'[^a-zA-Z0-9_]', '_', sec_title.lower()).strip('_')

                    if not sec_content or len(str(sec_content).strip()) < 15:
                        continue

                    page_str = f"Page {page_num}" if page_num else "Official Guideline Section"
                    doc = KnowledgeDocument(
                        document_id=f"icmr_{guideline_id}_{sec_id_val}",
                        source_id=self.source_id,
                        source_name=self.source_name,
                        publisher=self.publisher,
                        title=f"{guideline_title} - {sec_title}",
                        content=f"ICMR Clinical Guideline: {guideline_title} ({year})\nIssuing Body: {self.publisher}\nSection: {sec_title} ({page_str})\n\n{str(sec_content).strip()}",
                        source_url=url,
                        document_type=DocumentType.CLINICAL_GUIDELINE,
                        evidence_role=EvidenceRole.CLINICAL_GUIDELINE,
                        provenance_status=ProvenanceStatus.VERIFIED,
                        medical_domain=domain,
                        section=sec_title,
                        section_id=sec_id_val,
                        parent_document_id=f"icmr_{guideline_id}",
                        page_number=page_num,
                        publication_date=str(year),
                        entities=item.get("target_conditions", [guideline_title]),
                        version="2.9",
                        metadata={
                            "guideline_id": guideline_id,
                            "guideline_title": guideline_title,
                            "section_title": sec_title,
                            "page_number": page_num,
                            "publication_year": year,
                            "target_conditions": item.get("target_conditions", [])
                        }
                    )
                    documents.append(doc)
            elif item.get("content") and len(item.get("content", "").strip()) >= 15:
                doc = KnowledgeDocument(
                    document_id=f"icmr_{guideline_id}",
                    source_id=self.source_id,
                    source_name=self.source_name,
                    publisher=self.publisher,
                    title=guideline_title,
                    content=f"ICMR Clinical Guideline: {guideline_title} ({year})\nIssuing Body: {self.publisher}\n\n{item['content'].strip()}",
                    source_url=url,
                    document_type=DocumentType.CLINICAL_GUIDELINE,
                    evidence_role=EvidenceRole.CLINICAL_GUIDELINE,
                    provenance_status=ProvenanceStatus.VERIFIED,
                    medical_domain=domain,
                    section="Full Guideline",
                    section_id="full_guideline",
                    publication_date=str(year),
                    entities=item.get("target_conditions", [guideline_title]),
                    version="2.9",
                    metadata={
                        "guideline_id": guideline_id,
                        "guideline_title": guideline_title,
                        "publication_year": year
                    }
                )
                documents.append(doc)

        return documents
