"""
Reproducible MedQuAD Ingestion and Provenance-Preserving Loader.
Extracts questions, answers, URLs, institutes, focus concepts, and question types.
Preserves clinical casing and entity boundaries.
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
from rag_module.knowledge.source_registry import SOURCE_REGISTRY, get_source_info


def clean_medical_text(text: str) -> str:
    """
    Cleans raw medical text:
    - Strips HTML tags cleanly using BeautifulSoup.
    - Normalizes multi-spaces and line breaks.
    - PRESERVES case sensitivity for medical acronyms (e.g. ALL, COPD, HIV, MEN2A).
    """
    if not text:
        return ""
    
    # Strip HTML markup if present
    soup = BeautifulSoup(text, "html.parser")
    cleaned = soup.get_text(separator=" ")
    
    # Normalize whitespace without collapsing required line endings
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    cleaned = re.sub(r'\n\s*\n+', '\n\n', cleaned)
    return cleaned.strip()


def parse_medquad_xml(file_path: Path, folder_source: str) -> List[Dict[str, Any]]:
    """
    Parses a single MedQuAD XML file, extracting full provenance and QA pairs.
    """
    records = []
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        doc_id = root.attrib.get("id", file_path.stem)
        doc_source = root.attrib.get("source", folder_source)
        doc_url = root.attrib.get("url", "")
        
        focus_elem = root.find(".//Focus")
        focus_text = focus_elem.text.strip() if focus_elem is not None and focus_elem.text else ""
        
        for qapair in root.findall(".//QAPair"):
            q_elem = qapair.find("Question")
            a_elem = qapair.find("Answer")
            
            if q_elem is None or a_elem is None:
                continue
            if q_elem.text is None or a_elem.text is None:
                continue
            
            q_text = clean_medical_text(q_elem.text)
            a_text = clean_medical_text(a_elem.text)
            
            # Skip empty, invalid, or copyright-stripped answers
            if not a_text or a_text.lower() in ["none", "n/a", "not available", ""]:
                continue
            if len(a_text) < 15:
                continue
            
            qid = q_elem.attrib.get("qid", f"{doc_id}-qa")
            qtype = q_elem.attrib.get("qtype", "general")
            
            # Resolve source registry info
            source_info = get_source_info(doc_source)
            
            # Format high-quality combined QA text preserving clear boundaries
            structured_text = f"Question: {q_text}\nAnswer: {a_text}"
            
            record = {
                "doc_id": doc_id,
                "qid": qid,
                "source_id": source_info.source_id,
                "source_name": source_info.source_name,
                "publisher": source_info.publisher,
                "url": doc_url,
                "focus": focus_text,
                "qtype": qtype,
                "question": q_text,
                "answer": a_text,
                "text": structured_text  # Standardized text for indexing & chunking
            }
            records.append(record)
            
    except Exception as e:
        print(f"Warning: Failed to parse {file_path}: {e}")
        
    return records


def ingest_medquad(
    medquad_dir: Optional[Path] = None,
    output_path: Optional[Path] = None
) -> List[Dict[str, Any]]:
    """
    Ingests all MedQuAD XML files, building clean_corpus_v2.json with full provenance.
    """
    medquad_dir = medquad_dir or DEFAULT_CONFIG.MEDQUAD_DIR
    output_path = output_path or DEFAULT_CONFIG.CLEAN_CORPUS_V2_PATH
    
    if not medquad_dir.exists():
        raise FileNotFoundError(f"MedQuAD directory not found at: {medquad_dir}")
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    folder_mapping = {
        "1_CancerGov_QA": "CancerGov",
        "2_GARD_QA": "GARD",
        "3_GHR_QA": "GHR",
        "4_MPlus_Health_Topics_QA": "MPlus_Health_Topics",
        "5_NIDDK_QA": "NIDDK",
        "6_NINDS_QA": "NINDS",
        "7_SeniorHealth_QA": "SeniorHealth",
        "8_NHLBI_QA_XML": "NHLBI",
        "9_CDC_QA": "CDC",
        "10_MPlus_ADAM_QA": "ADAM",
        "11_MPlusDrugs_QA": "MPlusDrugs",
        "12_MPlusHerbsSupplements_QA": "MPlusHerbsSupplements"
    }
    
    all_records = []
    print(f"Starting MedQuAD ingestion from: {medquad_dir}")
    
    subfolders = sorted([d for d in os.listdir(medquad_dir) if (medquad_dir / d).is_dir()])
    
    for sub in subfolders:
        sub_path = medquad_dir / sub
        source_name = folder_mapping.get(sub, sub)
        xml_files = [sub_path / f for f in os.listdir(sub_path) if f.endswith(".xml")]
        
        folder_records = []
        for xml_file in xml_files:
            folder_records.extend(parse_medquad_xml(xml_file, source_name))
            
        print(f"  [{sub}] Processed {len(xml_files)} XML files -> {len(folder_records)} valid records")
        all_records.extend(folder_records)
        
    print(f"\nTotal ingested records with valid answers: {len(all_records)}")
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, indent=2, ensure_ascii=False)
        
    print(f"Saved clean corpus V2 to: {output_path} ({os.path.getsize(output_path)} bytes)")
    return all_records


if __name__ == "__main__":
    ingest_medquad()
