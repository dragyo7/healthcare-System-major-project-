"""
MedQuAD Source Adapter.
Parses MedQuAD XML files and clean_corpus_v2.json into canonical KnowledgeDocument objects.
"""
import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from tqdm import tqdm

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.knowledge.document_model import KnowledgeDocument
from rag_module.ingestion.base_adapter import BaseSourceAdapter
from rag_module.knowledge.source_registry import SOURCE_REGISTRY, get_source_info


def clean_medical_text(text: str) -> str:
    """Cleans raw medical text while preserving case sensitivity for acronyms."""
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    cleaned = soup.get_text(separator=" ")
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    cleaned = re.sub(r'\n\s*\n+', '\n\n', cleaned)
    return cleaned.strip()


class MedQuADAdapter(BaseSourceAdapter):
    """
    Adapter for MedQuAD medical question-answering dataset.
    """
    def __init__(
        self,
        source_id: str = "MedQuAD",
        source_name: str = "MedQuAD Medical Knowledge Base",
        publisher: str = "National Institutes of Health (NIH)",
        base_url: str = "https://github.com/abachaa/MedQuAD",
        raw_data_dir: Optional[Path] = None,
        clean_corpus_path: Optional[Path] = None
    ):
        super().__init__(
            source_id=source_id,
            source_name=source_name,
            publisher=publisher,
            base_url=base_url
        )
        self.raw_data_dir = raw_data_dir or DEFAULT_CONFIG.RAW_DATA_DIR
        self.clean_corpus_path = clean_corpus_path or DEFAULT_CONFIG.CLEAN_CORPUS_V2_PATH

    def load_raw_data(self) -> Any:
        """
        Loads pre-cleaned JSON corpus if present, otherwise raw XML files.
        """
        if self.clean_corpus_path.exists():
            with open(self.clean_corpus_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return self._load_raw_xml_files()

    def _load_raw_xml_files(self) -> List[Dict[str, Any]]:
        """Parses all MedQuAD subfolders."""
        if not self.raw_data_dir.exists():
            raise FileNotFoundError(f"Raw data directory not found at: {self.raw_data_dir}")

        all_records = []
        folder_mapping = {
            "1_CancerGov_QA": "CancerGov",
            "2_GARD_QA": "GARD",
            "3_GHR_QA": "GHR",
            "4_MPlus_Health_Topics_QA": "MPlus_Health_Topics",
            "5_NIDDK_QA": "NIDDK",
            "6_NINDS_QA": "NINDS",
            "7_SeniorHealth_QA": "SeniorHealth",
            "8_NHLBI_QA_xml": "NHLBI",
            "9_CDC_QA": "CDC"
        }

        for folder_name, source_id in folder_mapping.items():
            folder_path = self.raw_data_dir / folder_name
            if not folder_path.exists():
                continue

            xml_files = list(folder_path.glob("*.xml"))
            for xml_file in xml_files:
                records = self._parse_single_xml(xml_file, source_id)
                all_records.extend(records)

        return all_records

    def _parse_single_xml(self, file_path: Path, folder_source: str) -> List[Dict[str, Any]]:
        records = []
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()
            doc_id = root.attrib.get("id", file_path.stem)
            doc_url = root.attrib.get("url", "")
            
            focus_elem = root.find(".//Focus")
            focus_text = focus_elem.text.strip() if focus_elem is not None and focus_elem.text else ""

            src_info = get_source_info(folder_source)
            for qapair in root.findall(".//QAPair"):
                q_elem = qapair.find("Question")
                a_elem = qapair.find("Answer")
                if q_elem is None or a_elem is None or q_elem.text is None or a_elem.text is None:
                    continue

                q_text = clean_medical_text(q_elem.text)
                a_text = clean_medical_text(a_elem.text)
                if not a_text or len(a_text) < 15 or a_text.lower() in ["none", "n/a", "not available"]:
                    continue

                qid = qapair.attrib.get("pid", f"{doc_id}-q{len(records)+1}")
                qtype = qapair.attrib.get("qtype", "general")
                records.append({
                    "doc_id": doc_id,
                    "qid": qid,
                    "question": q_text,
                    "answer": a_text,
                    "source_id": folder_source,
                    "source_name": src_info.source_name if src_info else folder_source,
                    "publisher": src_info.publisher if src_info else "NIH",
                    "url": doc_url or (src_info.base_url if src_info else ""),
                    "focus": focus_text or file_path.stem,
                    "qtype": qtype
                })
        except Exception:
            pass
        return records

    def parse_and_normalize(self, raw_data: List[Dict[str, Any]]) -> List[KnowledgeDocument]:
        """Normalizes MedQuAD records into canonical KnowledgeDocument objects."""
        documents = []
        for item in raw_data:
            doc_id = item.get("doc_id") or item.get("qid") or "unknown_id"
            qid = item.get("qid", doc_id)
            question = item.get("question", "")
            answer = item.get("answer", "")
            focus = item.get("focus", "")
            src_id = item.get("source_id", "MedQuAD")
            src_name = item.get("source_name", "NIH Medical Knowledge Base")
            publisher = item.get("publisher", "National Institutes of Health")
            url = item.get("url", "")
            qtype = item.get("qtype", "general")

            content = f"Question: {question}\nAnswer: {answer}"
            title = focus if focus else question

            src_info = get_source_info(src_id)
            medical_domain = src_info.domains[0] if (src_info and src_info.domains) else "general_medicine"

            doc = KnowledgeDocument(
                document_id=f"medquad_{qid}",
                source_id=src_id,
                source_name=src_name,
                publisher=publisher,
                title=title,
                content=content,
                source_url=url,
                document_type="qa_pair",
                medical_domain=medical_domain,
                section=qtype,
                entities=[focus] if focus else [],
                version="2.3",
                metadata={
                    "qid": qid,
                    "qtype": qtype,
                    "original_doc_id": doc_id,
                    "focus": focus
                }
            )
            documents.append(doc)
        return documents
