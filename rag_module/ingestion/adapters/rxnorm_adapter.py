"""
RxNorm Source Adapter & Clinical Medicine Normalization Engine.
Parses NLM RxNorm Prescribable Content into canonical concepts and structured normalization tables.
"""
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Union, Tuple

from rag_module.knowledge.document_model import KnowledgeDocument, DocumentType, EvidenceRole, ProvenanceStatus
from rag_module.ingestion.base_adapter import BaseSourceAdapter


class RxNormConcept:
    """Structured representation of a normalized clinical medication concept."""
    def __init__(
        self,
        rxcui: str,
        name: str,
        ingredient: str,
        brand_names: List[str],
        dosage_form: str = "",
        strength: str = "",
        therapeutic_class: str = ""
    ):
        self.rxcui = rxcui
        self.name = name
        self.ingredient = ingredient.lower().strip()
        self.brand_names = [b.lower().strip() for b in brand_names]
        self.dosage_form = dosage_form
        self.strength = strength
        self.therapeutic_class = therapeutic_class

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rxcui": self.rxcui,
            "name": self.name,
            "ingredient": self.ingredient,
            "brand_names": self.brand_names,
            "dosage_form": self.dosage_form,
            "strength": self.strength,
            "therapeutic_class": self.therapeutic_class
        }


class RxNormNormalizer:
    """
    Deterministic clinical drug normalizer resolving generic/brand aliases to canonical RxNorm concepts.
    """
    def __init__(self, concepts_dict: Optional[Dict[str, Any]] = None):
        self.concepts: Dict[str, RxNormConcept] = {}
        self.alias_map: Dict[str, str] = {}  # alias_lower -> rxcui

        if concepts_dict:
            self.load_from_dict(concepts_dict)

    def load_from_dict(self, concepts_data: Union[List[Dict[str, Any]], Dict[str, Any]]) -> None:
        items = concepts_data.get("concepts", []) if isinstance(concepts_data, dict) else concepts_data
        for item in items:
            concept = RxNormConcept(
                rxcui=str(item.get("rxcui", "")),
                name=item.get("name", ""),
                ingredient=item.get("ingredient", item.get("generic_name", "")),
                brand_names=item.get("brand_names", item.get("brands", [])),
                dosage_form=item.get("dosage_form", ""),
                strength=item.get("strength", ""),
                therapeutic_class=item.get("therapeutic_class", "")
            )
            if not concept.rxcui:
                continue

            self.concepts[concept.rxcui] = concept
            # Index canonical names and ingredients
            self.alias_map[concept.name.lower()] = concept.rxcui
            self.alias_map[concept.ingredient.lower()] = concept.rxcui

            # Index brand aliases
            for brand in concept.brand_names:
                self.alias_map[brand.lower()] = concept.rxcui

    def normalize(self, medicine_text: str) -> Optional[RxNormConcept]:
        """
        Normalizes a medicine string (brand, generic, or dirty query text) into an RxNormConcept.
        """
        if not medicine_text or not medicine_text.strip():
            return None

        clean_text = medicine_text.lower().strip()
        # Direct exact match
        if clean_text in self.alias_map:
            return self.concepts.get(self.alias_map[clean_text])

        # Strip dosage suffixes (e.g. "metformin 500mg" -> "metformin")
        stemmed = re.sub(r'\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units|tab|tablet|cap|capsule)\b', '', clean_text).strip()
        if stemmed in self.alias_map:
            return self.concepts.get(self.alias_map[stemmed])

        # Token match
        for alias, rxcui in self.alias_map.items():
            if alias and (alias in clean_text or clean_text in alias):
                return self.concepts.get(rxcui)

        return None


class RxNormAdapter(BaseSourceAdapter):
    """
    Adapter for RxNorm Prescribable Content.
    """
    def __init__(
        self,
        source_id: str = "RxNorm",
        source_name: str = "RxNorm Normalized Prescribable Clinical Terminology",
        publisher: str = "National Library of Medicine (NLM/NIH)",
        base_url: str = "https://www.nlm.nih.gov/research/umls/rxnorm/",
        data_source: Optional[Any] = None
    ):
        super().__init__(
            source_id=source_id,
            source_name=source_name,
            publisher=publisher,
            base_url=base_url
        )
        self.data_source = data_source
        self.normalizer = RxNormNormalizer()

    def load_raw_data(self) -> Any:
        if self.data_source is None:
            default_path = Path("data/knowledge_bases/rxnorm/rxnorm_prescribable.json")
            if default_path.exists():
                with open(default_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.normalizer.load_from_dict(data)
                    return data
            return []
        if isinstance(self.data_source, (list, dict)):
            self.normalizer.load_from_dict(self.data_source)
            return self.data_source
        if isinstance(self.data_source, (str, Path)):
            p = Path(self.data_source)
            if p.is_file() and p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.normalizer.load_from_dict(data)
                    return data
        return []

    def parse_and_normalize(self, raw_data: Union[List[Dict[str, Any]], Dict[str, Any]]) -> List[KnowledgeDocument]:
        if isinstance(raw_data, dict):
            raw_data = raw_data.get("concepts", raw_data.get("results", [raw_data]))

        if not isinstance(raw_data, list):
            return []

        documents = []
        for item in raw_data:
            if not isinstance(item, dict):
                self.stats["documents_rejected"] += 1
                continue

            rxcui = str(item.get("rxcui", ""))
            name = item.get("name") or item.get("generic_name", "Clinical Medication")
            ingredient = item.get("ingredient") or item.get("generic_name", name)
            brands = item.get("brand_names", item.get("brands", []))
            dosage_form = item.get("dosage_form", "")
            strength = item.get("strength", "")
            therapeutic_class = item.get("therapeutic_class", "General Pharmacology")

            if not rxcui:
                self.stats["documents_rejected"] += 1
                continue

            brands_str = ", ".join(brands) if brands else "None"
            content = (
                f"Medication Concept: {name}\n"
                f"RxCUI: {rxcui}\n"
                f"Active Ingredient: {ingredient}\n"
                f"Brand / Trade Names: {brands_str}\n"
                f"Dosage Form: {dosage_form}\n"
                f"Strength: {strength}\n"
                f"Therapeutic Class: {therapeutic_class}\n"
                f"Authority: {self.publisher}"
            )

            doc = KnowledgeDocument(
                document_id=f"rxnorm_{rxcui}",
                source_id=self.source_id,
                source_name=self.source_name,
                publisher=self.publisher,
                title=f"RxNorm Concept: {name} (RxCUI: {rxcui})",
                content=content,
                source_url=f"https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm={rxcui}",
                document_type=DocumentType.DRUG_MONOGRAPH,
                evidence_role=EvidenceRole.TERMINOLOGY_CONCEPT,
                provenance_status=ProvenanceStatus.VERIFIED,
                medical_domain="pharmacology",
                section="Clinical Concept Summary",
                section_id="concept_summary",
                entities=[ingredient] + brands,
                version="2026-02",
                metadata={
                    "rxcui": rxcui,
                    "canonical_name": name,
                    "ingredient": ingredient,
                    "brand_names": brands,
                    "dosage_form": dosage_form,
                    "strength": strength,
                    "therapeutic_class": therapeutic_class
                }
            )
            documents.append(doc)

        return documents
