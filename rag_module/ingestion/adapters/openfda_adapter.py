"""
openFDA Drug Labeling Source Adapter.
Parses authentic openFDA Drug Product Labeling API responses and JSON dumps
into canonical KnowledgeDocument objects.
"""
import re
import json
from typing import List, Dict, Any, Optional, Union
from pathlib import Path

from rag_module.knowledge.document_model import KnowledgeDocument, DocumentType
from rag_module.ingestion.base_adapter import BaseSourceAdapter


class OpenFDAAdapter(BaseSourceAdapter):
    """
    Adapter for openFDA Drug Product Labeling API records.
    Supports official FDA JSON payloads with complete openfda metadata preservation.
    """
    def __init__(
        self,
        source_id: str = "openFDA",
        source_name: str = "FDA Drug Product Labeling API",
        publisher: str = "U.S. Food and Drug Administration",
        base_url: str = "https://open.fda.gov/apis/drug/label/",
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
        """Loads openFDA JSON response files or data structures."""
        if self.data_source is None:
            return []
        if isinstance(self.data_source, list):
            return self.data_source
        if isinstance(self.data_source, dict):
            return self.data_source.get("results", [self.data_source])
        if isinstance(self.data_source, (str, Path)):
            p = Path(self.data_source)
            if p.is_file():
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        return data.get("results", [data])
                    return data
        return []

    def parse_and_normalize(self, raw_data: Union[List[Dict[str, Any]], Dict[str, Any]]) -> List[KnowledgeDocument]:
        """Normalizes openFDA records into canonical KnowledgeDocument objects."""
        if isinstance(raw_data, dict):
            raw_data = raw_data.get("results", [raw_data])

        if not isinstance(raw_data, list):
            return []

        documents = []
        for item in raw_data:
            if not isinstance(item, dict):
                self.stats["documents_rejected"] += 1
                continue

            openfda = item.get("openfda", {})
            if not isinstance(openfda, dict):
                openfda = {}

            brand_names = openfda.get("brand_name", [])
            generic_names = openfda.get("generic_name", [])
            substance_names = openfda.get("substance_name", [])
            manufacturers = openfda.get("manufacturer_name", [])
            pharm_classes = openfda.get("pharm_class_epc", [])
            app_numbers = openfda.get("application_number", [])
            routes = openfda.get("route", [])
            package_ndcs = openfda.get("package_ndc", [])
            rxcuis = openfda.get("rxcui", [])

            # Determine primary drug title
            if brand_names and brand_names[0]:
                drug_title = brand_names[0].title()
            elif generic_names and generic_names[0]:
                drug_title = generic_names[0].title()
            elif substance_names and substance_names[0]:
                drug_title = substance_names[0].title()
            else:
                drug_title = item.get("title", "FDA Regulated Drug")

            # Check allowlist
            if self.allowlist:
                all_identities = [drug_title.lower()] + [b.lower() for b in brand_names] + [g.lower() for g in generic_names] + [s.lower() for s in substance_names]
                if not any(al in ident for al in self.allowlist for ident in all_identities):
                    continue

            spl_set_id = item.get("set_id") or openfda.get("spl_set_id", [""])[0] or openfda.get("spl_id", [""])[0] or item.get("id", "")
            doc_id = spl_set_id or re.sub(r'[^a-zA-Z0-9_]', '_', drug_title.lower()).strip('_')

            def get_field_text(key: str) -> str:
                val = item.get(key, [])
                if isinstance(val, list):
                    return "\n\n".join(str(v).strip() for v in val if v and str(v).strip())
                return str(val).strip() if val else ""

            sections = {
                "Boxed Warning": get_field_text("boxed_warning"),
                "Indications & Usage": get_field_text("indications_and_usage"),
                "Dosage & Administration": get_field_text("dosage_and_administration"),
                "Contraindications": get_field_text("contraindications"),
                "Warnings & Precautions": get_field_text("warnings_and_cautions") or get_field_text("warnings"),
                "Adverse Reactions": get_field_text("adverse_reactions"),
                "Drug Interactions": get_field_text("drug_interactions"),
                "Use in Specific Populations": get_field_text("use_in_specific_populations"),
                "Clinical Pharmacology": get_field_text("clinical_pharmacology"),
                "How Supplied": get_field_text("how_supplied")
            }

            url = f"https://api.fda.gov/drug/label.json?search=id:{item.get('id', doc_id)}" if item.get("id") else f"https://open.fda.gov/apis/drug/label/"

            for sec_name, sec_text in sections.items():
                if not sec_text or len(sec_text.strip()) < 15:
                    continue
                sec_id = re.sub(r'[^a-zA-Z0-9_]', '_', sec_name.lower()).strip('_')
                
                doc = KnowledgeDocument(
                    document_id=f"openfda_{doc_id}_{sec_id}",
                    source_id=self.source_id,
                    source_name=self.source_name,
                    publisher=self.publisher,
                    title=f"{drug_title} - {sec_name}",
                    content=f"Drug: {drug_title}\nSection: {sec_name}\n\n{sec_text.strip()}",
                    source_url=url,
                    document_type=DocumentType.DRUG_MONOGRAPH,
                    medical_domain="pharmacology",
                    section=sec_name,
                    entities=list(set(brand_names + generic_names + substance_names)),
                    version="2.4",
                    metadata={
                        "drug_name": drug_title,
                        "brand_names": brand_names,
                        "generic_names": generic_names,
                        "substance_names": substance_names,
                        "manufacturers": manufacturers,
                        "pharm_classes": pharm_classes,
                        "application_numbers": app_numbers,
                        "routes": routes,
                        "package_ndcs": package_ndcs,
                        "rxcuis": rxcuis,
                        "spl_set_id": spl_set_id,
                        "label_section": sec_name
                    }
                )
                documents.append(doc)

        return documents
