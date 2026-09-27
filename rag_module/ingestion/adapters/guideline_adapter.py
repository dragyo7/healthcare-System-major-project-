"""
Clinical Practice Guideline Source Adapter.
Parses clinical practice guidelines, consensus statements, and public health documents into canonical KnowledgeDocument objects.
"""
from typing import List, Dict, Any, Optional
from pathlib import Path

from rag_module.knowledge.document_model import KnowledgeDocument
from rag_module.ingestion.base_adapter import BaseSourceAdapter


class GuidelineAdapter(BaseSourceAdapter):
    """
    Adapter for clinical practice guidelines (e.g. PMC, WHO, CDC, Professional Societies).
    """
    def __init__(
        self,
        source_id: str = "ClinicalGuidelines",
        source_name: str = "Clinical Practice Guidelines",
        publisher: str = "Medical Professional Society",
        base_url: str = "https://www.ncbi.nlm.nih.gov/pmc/",
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
            return []
        if isinstance(self.data_source, list):
            return self.data_source
        if isinstance(self.data_source, (str, Path)) and Path(self.data_source).exists():
            import json
            with open(self.data_source, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def parse_and_normalize(self, raw_data: List[Dict[str, Any]]) -> List[KnowledgeDocument]:
        documents = []
        for item in raw_data:
            guideline_id = item.get("guideline_id") or item.get("id", "guideline_001")
            title = item.get("guideline_title") or item.get("title", "Clinical Practice Guideline")
            organization = item.get("organization") or self.publisher
            condition = item.get("condition") or item.get("disease", "General")
            year = item.get("publication_year") or item.get("year", 2024)
            url = item.get("url", "")
            recommendations = item.get("recommendations", [])
            evidence_grade = item.get("evidence_grade", "Grade A")

            # Check if multi-section guideline structure is provided
            sections_list = item.get("sections")
            if isinstance(sections_list, list) and sections_list:
                for idx, sec in enumerate(sections_list):
                    heading = sec.get("heading") or sec.get("title", f"Section {idx+1}")
                    sec_content = sec.get("content") or sec.get("text", "")
                    sec_grade = sec.get("recommendation_grade") or evidence_grade
                    if not sec_content or len(sec_content.strip()) < 10:
                        continue
                    sec_id = heading.lower().replace(" ", "_")
                    doc = KnowledgeDocument(
                        document_id=f"guideline_{guideline_id}_{sec_id}",
                        source_id=self.source_id,
                        source_name=f"{organization} Clinical Guidelines",
                        publisher=organization,
                        title=f"{title} - {heading}",
                        content=f"Guideline: {title}\nOrganization: {organization} ({year})\nSection: {heading}\nRecommendation Grade: {sec_grade}\n\n{sec_content.strip()}",
                        source_url=url,
                        document_type="clinical_guideline",
                        medical_domain=item.get("medical_domain", "evidence_based_medicine"),
                        section=heading,
                        entities=[condition] + item.get("interventions", []),
                        version="2.3",
                        metadata={
                            "guideline_id": guideline_id,
                            "organization": organization,
                            "publication_year": year,
                            "recommendation_grade": sec_grade,
                            "target_condition": condition
                        }
                    )
                    documents.append(doc)
            else:
                full_text = item.get("content", "")
                if not full_text and recommendations:
                    rec_lines = [f"- {r.get('text', str(r))}" for r in recommendations]
                    full_text = f"Guideline: {title}\nOrganization: {organization} ({year})\nCondition: {condition}\nEvidence Level: {evidence_grade}\n\nKey Clinical Recommendations:\n" + "\n".join(rec_lines)

                doc = KnowledgeDocument(
                    document_id=f"guideline_{guideline_id}",
                    source_id=self.source_id,
                    source_name=f"{organization} Clinical Guidelines",
                    publisher=organization,
                    title=title,
                    content=full_text,
                    source_url=url,
                    document_type="clinical_guideline",
                    medical_domain=item.get("medical_domain", "evidence_based_medicine"),
                    section=item.get("section", "Recommendations"),
                    entities=[condition] + item.get("interventions", []),
                    version="2.3",
                    metadata={
                        "guideline_id": guideline_id,
                        "organization": organization,
                        "publication_year": year,
                        "evidence_grade": evidence_grade,
                        "target_condition": condition
                    }
                )
                documents.append(doc)

        return documents
