"""
DailyMed Source Adapter.
Parses authentic FDA Structured Product Labeling (SPL) XML files and JSON monographs
into canonical KnowledgeDocument objects.
"""
import re
import json
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
from bs4 import BeautifulSoup

from rag_module.knowledge.document_model import KnowledgeDocument, DocumentType, EvidenceRole, ProvenanceStatus
from rag_module.ingestion.base_adapter import BaseSourceAdapter


# Standard LOINC section codes for FDA SPL package inserts
SPL_LOINC_MAP = {
    "34067-9": "Indications & Usage",
    "34068-7": "Dosage & Administration",
    "34070-3": "Contraindications",
    "42232-9": "Warnings & Precautions",
    "34084-4": "Adverse Reactions",
    "34073-7": "Drug Interactions",
    "34066-1": "Boxed Warning",
    "43678-2": "Use in Specific Populations",
    "34090-1": "Clinical Pharmacology",
    "34069-5": "How Supplied"
}


def clean_xml_text(element: Optional[ET.Element]) -> str:
    """Extracts and cleans all text inside an XML element recursively."""
    if element is None:
        return ""
    text_chunks = []
    for t in element.itertext():
        if t and t.strip():
            text_chunks.append(t.strip())
    raw = " ".join(text_chunks)
    cleaned = re.sub(r'\s+', ' ', raw)
    return cleaned.strip()


class DailyMedAdapter(BaseSourceAdapter):
    """
    Adapter for DailyMed / FDA Structured Product Labeling (SPL) drug package inserts.
    Supports both structured JSON and raw SPL XML documents.
    """
    def __init__(
        self,
        source_id: str = "DailyMed",
        source_name: str = "National Library of Medicine DailyMed",
        publisher: str = "U.S. National Library of Medicine / FDA",
        base_url: str = "https://dailymed.nlm.nih.gov",
        data_source: Optional[Any] = None,
        allowlist: Optional[List[str]] = None
    ):
        super().__init__(
            source_id=source_id,
            source_name=source_name,
            publisher=publisher,
            base_url=base_url
        )
        self.data_source = data_source
        self.allowlist = [item.lower().strip() for item in allowlist] if allowlist else []

    def load_raw_data(self) -> Any:
        """Loads drug label dictionaries, JSON files, or XML files."""
        if self.data_source is None:
            # Check verified authentic DailyMed SPL dataset first
            essential_path = Path("data/knowledge_bases/dailymed/dailymed_essential_spl.json")
            if essential_path.exists():
                with open(essential_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            
            default_path = Path(r"e:\Major Project Code") / "rag_module" / "data" / "dailymed_raw.json"
            if not default_path.exists():
                default_path = Path(r"e:\Major Project Code") / "rag_module" / "data" / "dailymed_pilot_raw.json"
            if default_path.exists():
                with open(default_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data if isinstance(data, list) else data.get("results", [data])
            return []
        if isinstance(self.data_source, list):
            return self.data_source
        if isinstance(self.data_source, (str, Path)):
            p = Path(self.data_source)
            if p.is_file():
                if p.suffix.lower() == ".json":
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        return data if isinstance(data, list) else data.get("results", [data])
                elif p.suffix.lower() == ".xml":
                    return [p.read_text(encoding="utf-8")]
            elif p.is_dir():
                xml_files = list(p.glob("*.xml"))
                return [f.read_text(encoding="utf-8") for f in xml_files]
        return []

    def parse_and_normalize(self, raw_data: Union[List[Dict[str, Any]], List[str], Dict[str, Any]]) -> List[KnowledgeDocument]:
        """Normalizes drug monographs from JSON or XML into canonical KnowledgeDocument objects."""
        if isinstance(raw_data, dict):
            raw_data = raw_data.get("results", [raw_data]) if "results" in raw_data else [raw_data]

        documents = []
        for item in raw_data:
            if isinstance(item, str) and ("<document" in item or "<?xml" in item):
                docs = self._parse_spl_xml(item)
                documents.extend(docs)
            elif isinstance(item, dict):
                docs = self._parse_spl_dict(item)
                documents.extend(docs)
        return documents

    def _parse_spl_xml(self, xml_content: str) -> List[KnowledgeDocument]:
        """Parses HL7 SPL XML document into section-level KnowledgeDocuments."""
        docs = []
        try:
            # Strip XML default namespaces for robust element finding
            cleaned_xml = re.sub(r'\sxmlns="[^"]+"', '', xml_content, count=1)
            root = ET.fromstring(cleaned_xml)
            
            set_id_elem = root.find(".//setId")
            set_id = set_id_elem.attrib.get("root", "unknown_spl") if set_id_elem is not None else "unknown_spl"
            
            title_elem = root.find(".//title")
            raw_title = clean_xml_text(title_elem) or "FDA Drug Product Label"
            
            # Extract manufactured product name if present
            prod_name_elem = root.find(".//manufacturedProduct/manufacturedDrug/name")
            drug_name = clean_xml_text(prod_name_elem) if prod_name_elem is not None else raw_title.split()[0]
            
            # Check allowlist filter
            if self.allowlist and not any(al in drug_name.lower() or al in raw_title.lower() for al in self.allowlist):
                return []

            url = f"{self.base_url}/dailymed/drugInfo.cfm?setid={set_id}"
            
            # Iterate through structured body sections
            sections = root.findall(".//structuredBody/component/section")
            for sec in sections:
                code_elem = sec.find("code")
                loinc_code = code_elem.attrib.get("code", "") if code_elem is not None else ""
                sec_title_elem = sec.find("title")
                sec_heading = clean_xml_text(sec_title_elem) or SPL_LOINC_MAP.get(loinc_code, "Clinical Information")
                
                # Extract text body
                text_elem = sec.find("text")
                sec_content = clean_xml_text(text_elem)
                if not sec_content or len(sec_content.strip()) < 15:
                    continue
                
                sec_id = re.sub(r'[^a-zA-Z0-9_]', '_', sec_heading.lower()).strip('_')
                doc = KnowledgeDocument(
                    document_id=f"dailymed_{set_id}_{sec_id}",
                    source_id=self.source_id,
                    source_name=self.source_name,
                    publisher=self.publisher,
                    title=f"{drug_name} - {sec_heading}",
                    content=f"Drug: {drug_name}\nSection: {sec_heading}\n\n{sec_content}",
                    source_url=url,
                    document_type=DocumentType.DRUG_MONOGRAPH,
                    medical_domain="pharmacology",
                    section=sec_heading,
                    entities=[drug_name],
                    version="2.6",
                    metadata={
                        "drug_name": drug_name,
                        "set_id": set_id,
                        "loinc_code": loinc_code,
                        "label_section": sec_heading
                    }
                )
                docs.append(doc)
        except Exception:
            self.stats["documents_rejected"] += 1
        return docs

    def _parse_spl_dict(self, item: Dict[str, Any]) -> List[KnowledgeDocument]:
        """Parses structured JSON dictionary into KnowledgeDocuments."""
        raw_drug = item.get("drug_name") or item.get("generic_name") or item.get("title") or "Unknown Drug"
        drug_name = str(raw_drug)
        raw_generic = item.get("generic_name") or drug_name
        generic_name = str(raw_generic)
        brand_names = [str(b) for b in item.get("brand_names", [])] if isinstance(item.get("brand_names"), list) else ([str(item.get("brand_name"))] if item.get("brand_name") else [])
        active_ingredient = str(item.get("active_ingredient", "")) if item.get("active_ingredient") is not None else ""
        dosage_form = str(item.get("dosage_form", "")) if item.get("dosage_form") is not None else ""
        strength = str(item.get("strength", "")) if item.get("strength") is not None else ""
        ndc_code = str(item.get("ndc_code", "")) if item.get("ndc_code") is not None else ""
        raw_id = item.get("set_id") or item.get("id") or drug_name.lower().replace(" ", "_")
        set_id = str(raw_id)
        url = str(item.get("url", f"{self.base_url}/dailymed/drugInfo.cfm?setid={set_id}"))

        # Check allowlist filter
        if self.allowlist and not any(al in drug_name.lower() or al in generic_name.lower() for al in self.allowlist):
            return []

        raw_sections = item.get("sections") if isinstance(item.get("sections"), dict) else {}

        # Extract distinct clinical sections
        sections = {
            "Indications & Usage": raw_sections.get("indications_and_usage") or raw_sections.get("indications") or item.get("indications_and_usage") or item.get("indications", ""),
            "Dosage & Administration": raw_sections.get("dosage_and_administration") or raw_sections.get("dosage") or item.get("dosage_and_administration") or item.get("dosage", ""),
            "Contraindications": raw_sections.get("contraindications") or item.get("contraindications", ""),
            "Warnings & Precautions": raw_sections.get("warnings_and_precautions") or raw_sections.get("warnings") or item.get("warnings_and_precautions") or item.get("warnings", ""),
            "Adverse Reactions": raw_sections.get("adverse_reactions") or raw_sections.get("side_effects") or item.get("adverse_reactions") or item.get("side_effects", ""),
            "Drug Interactions": raw_sections.get("drug_interactions") or item.get("drug_interactions", ""),
            "Boxed Warning": raw_sections.get("boxed_warning") or item.get("boxed_warning", ""),
            "Use in Specific Populations": raw_sections.get("use_in_specific_populations") or item.get("use_in_specific_populations", ""),
            "Overdosage": raw_sections.get("overdosage") or item.get("overdosage", ""),
            "Clinical Pharmacology": raw_sections.get("clinical_pharmacology") or item.get("clinical_pharmacology", "")
        }

        # If full monograph content is provided directly
        full_content = item.get("content", "")
        if full_content and len(full_content.strip()) >= 15:
            doc = KnowledgeDocument(
                document_id=f"dailymed_{set_id}",
                source_id=self.source_id,
                source_name=self.source_name,
                publisher=self.publisher,
                title=f"{drug_name} Package Insert",
                content=full_content,
                source_url=url,
                document_type=DocumentType.DRUG_MONOGRAPH,
                medical_domain="pharmacology",
                section="Full Label",
                entities=[drug_name, generic_name] + brand_names + ([active_ingredient] if active_ingredient else []),
                version="2.4",
                metadata={
                    "drug_name": drug_name,
                    "generic_name": generic_name,
                    "brand_names": brand_names,
                    "active_ingredient": active_ingredient,
                    "dosage_form": dosage_form,
                    "strength": strength,
                    "ndc_code": ndc_code,
                    "set_id": set_id
                }
            )
            return [doc]

        docs = []
        # Create section-level atomic knowledge documents
        for sec_name, sec_text in sections.items():
            if not sec_text or len(str(sec_text).strip()) < 15:
                continue
            text_str = sec_text if isinstance(sec_text, str) else " ".join(sec_text)
            sec_id = re.sub(r'[^a-zA-Z0-9_]', '_', sec_name.lower()).strip('_')
            doc = KnowledgeDocument(
                document_id=f"dailymed_{set_id}_{sec_id}",
                source_id=self.source_id,
                source_name=self.source_name,
                publisher=self.publisher,
                title=f"{drug_name} - {sec_name}",
                content=f"Drug: {drug_name}\nSection: {sec_name}\n\n{text_str.strip()}",
                source_url=url,
                document_type=DocumentType.DRUG_MONOGRAPH,
                evidence_role=EvidenceRole.PRIMARY_MONOGRAPH,
                provenance_status=ProvenanceStatus.VERIFIED,
                medical_domain="pharmacology",
                section=sec_name,
                section_id=sec_id,
                parent_document_id=f"dailymed_{set_id}",
                entities=[drug_name, generic_name] + brand_names + ([active_ingredient] if active_ingredient else []),
                version="2.9",
                metadata={
                    "drug_name": drug_name,
                    "generic_name": generic_name,
                    "brand_names": brand_names,
                    "active_ingredient": active_ingredient,
                    "dosage_form": dosage_form,
                    "strength": strength,
                    "ndc_code": ndc_code,
                    "label_section": sec_name,
                    "set_id": set_id
                }
            )
            docs.append(doc)

        return docs
