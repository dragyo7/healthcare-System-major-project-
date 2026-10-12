import os
import sys
import json
import pickle
from pathlib import Path

sys.path.insert(0, os.path.abspath("."))

def audit_everything():
    results = {}

    print("=========================================================")
    print("1. VERIFYING INDEX & METADATA CONSISTENCY ACROSS LOCATIONS")
    print("=========================================================")

    index_dirs = [
        "rag_module/data/faiss_index",
        "data/indices/production",
        "data/indices/golden_236"
    ]

    for d in index_dirs:
        faiss_p = os.path.join(d, "index_v2.bin")
        meta_p = os.path.join(d, "meta_v2.pkl")
        meta_j = os.path.join(d, "meta_v2.json")
        bm25_p = os.path.join(d, "bm25_index.pkl")

        import faiss
        idx = faiss.read_index(faiss_p)
        with open(meta_p, "rb") as f:
            mp = pickle.load(f)
        with open(meta_j, "r", encoding="utf-8") as f:
            mj = json.load(f)
        
        from rag_module.retrieval.bm25_retriever import BM25Retriever
        bm25 = BM25Retriever.load(Path(bm25_p))

        print(f"Directory: {d}")
        print(f"  FAISS ntotal: {idx.ntotal}, dim: {idx.d}")
        print(f"  meta_v2.pkl count: {len(mp)}")
        print(f"  meta_v2.json count: {len(mj)}")
        print(f"  bm25 corpus_size: {bm25.corpus_size}")
        print(f"  bm25 metadata count: {len(bm25.metadata)}")

        # Check alignment of chunk IDs between FAISS (0..N-1), meta_pkl, meta_json, and bm25
        pkl_ids = [x.get("chunk_id") for x in mp]
        json_ids = [x.get("chunk_id") for x in mj]
        bm25_ids = [x.get("chunk_id") for x in bm25.metadata]

        print(f"  pkl_ids == json_ids: {pkl_ids == json_ids}")
        print(f"  pkl_ids == bm25_ids: {pkl_ids == bm25_ids}")
        print(f"  Unique chunk IDs: {len(set(pkl_ids))}")

    print("\n=========================================================")
    print("2. PRODUCTION CORPUS (2,204 chunks) DETAILED BREAKDOWN")
    print("=========================================================")

    with open("rag_module/data/faiss_index/meta_v2.pkl", "rb") as f:
        prod_meta = pickle.load(f)

    breakdown = {}
    for i, c in enumerate(prod_meta):
        src_name = c.get("source_name", "UNKNOWN")
        src_id = c.get("source_id", "UNKNOWN")
        pub = c.get("publisher", "UNKNOWN")
        doc_id = c.get("document_id", "UNKNOWN")
        title = c.get("title", "UNKNOWN")
        url = c.get("source_url") or c.get("url", "UNKNOWN")
        domain = c.get("medical_domain", "UNKNOWN")
        doc_type = c.get("document_type", "UNKNOWN")
        section = c.get("section", "UNKNOWN")

        key = (src_name, src_id, pub)
        if key not in breakdown:
            breakdown[key] = {
                "chunks": 0,
                "docs": set(),
                "titles": set(),
                "urls": set(),
                "sections": set(),
                "domains": set(),
                "doc_types": set(),
                "sample_chunk_id": c.get("chunk_id"),
                "sample_title": title,
                "sample_doc_id": doc_id,
                "sample_url": url,
                "sample_text_snippet": c.get("text", "")[:150]
            }
        breakdown[key]["chunks"] += 1
        breakdown[key]["docs"].add(doc_id)
        breakdown[key]["titles"].add(title)
        breakdown[key]["urls"].add(url)
        breakdown[key]["sections"].add(section)
        breakdown[key]["domains"].add(domain)
        breakdown[key]["doc_types"].add(doc_type)

    total_chunks = 0
    total_docs = 0
    print(f"{'Source Name':<60} | {'Source ID':<15} | {'Publisher':<40} | {'Docs':<6} | {'Chunks':<6}")
    print("-" * 140)
    for (src_name, src_id, pub), data in breakdown.items():
        print(f"{src_name:<60} | {src_id:<15} | {pub:<40} | {len(data['docs']):<6} | {data['chunks']:<6}")
        total_chunks += data["chunks"]
        total_docs += len(data["docs"])
    print("-" * 140)
    print(f"{'TOTAL':<60} | {'':<15} | {'':<40} | {total_docs:<6} | {total_chunks:<6}")

    print("\nDetailed Provenance Samples:")
    for (src_name, src_id, pub), data in breakdown.items():
        print(f"\n--- {src_name} ({src_id}) ---")
        print(f"  Publisher: {pub}")
        print(f"  Chunks: {data['chunks']}, Docs: {len(data['docs'])}, Titles: {len(data['titles'])}, URLs: {len(data['urls'])}")
        print(f"  Document Types: {data['doc_types']}")
        print(f"  Medical Domains: {data['domains']}")
        print(f"  Sections sample: {list(data['sections'])[:6]}")
        print(f"  Sample Doc ID: {data['sample_doc_id']}")
        print(f"  Sample Chunk ID: {data['sample_chunk_id']}")
        print(f"  Sample Title: {data['sample_title']}")
        print(f"  Sample URL: {data['sample_url']}")
        print(f"  Sample Snippet: {repr(data['sample_text_snippet'])}")

    print("\n=========================================================")
    print("3. AUDITING ALL INGESTION ADAPTERS IN rag_module/ingestion/adapters/")
    print("=========================================================")
    adapter_dir = "rag_module/ingestion/adapters"
    adapters = [f for f in os.listdir(adapter_dir) if f.endswith(".py") and f != "__init__.py"]
    for a in sorted(adapters):
        ap = os.path.join(adapter_dir, a)
        print(f"\nAdapter File: {a}")
        with open(ap, "r", encoding="utf-8") as af:
            content = af.read()
        
        # Check class names
        import re
        classes = re.findall(r"class\s+([A-Za-z0-9_]+)", content)
        print(f"  Classes defined: {classes}")
        
        # Check source IDs and methods
        source_id_match = re.findall(r"source_id\s*=\s*['\"]([^'\"]+)['\"]", content)
        print(f"  source_id attributes: {source_id_match}")
        
        # Check fetch/load/parse methods
        methods = re.findall(r"def\s+([A-Za-z0-9_]+)", content)
        print(f"  Methods: {methods[:8]}")

    print("\n=========================================================")
    print("4. AUDITING SOURCE REGISTRIES & CATALOGS")
    print("=========================================================")
    cat_path = "data/manifests/source_catalog.json"
    if os.path.exists(cat_path):
        with open(cat_path, "r", encoding="utf-8") as f:
            cat = json.load(f)
        print(f"source_catalog.json ({len(cat)} entries):")
        for k, v in (cat.items() if isinstance(cat, dict) else enumerate(cat)):
            print(f"  Key: {k} -> {v if isinstance(v, str) else list(v.keys()) if isinstance(v, dict) else v}")

    reg_path = "data/registry/knowledge_base_registry.json"
    if os.path.exists(reg_path):
        with open(reg_path, "r", encoding="utf-8") as f:
            reg = json.load(f)
        print(f"\nknowledge_base_registry.json:")
        if isinstance(reg, dict):
            print(f"  Keys: {list(reg.keys())}")
            for rk, rv in reg.items():
                if isinstance(rv, list):
                    print(f"  {rk}: list of {len(rv)} items")
                elif isinstance(rv, dict):
                    print(f"  {rk}: dict with {len(rv)} entries: {list(rv.keys())[:5]}")

    print("\n=========================================================")
    print("5. AUDITING DRUG MODULE & PRESCRIPTION MODULE ENGINES")
    print("=========================================================")
    
    # Drug module
    from drug_module.data_loader import DataLoader
    dl = DataLoader()
    print("Drug DataLoader loaded successfully.")
    print(f"  Interactions count: {len(dl.interactions) if hasattr(dl, 'interactions') else 'N/A'}")
    print(f"  Side effects count: {len(dl.side_effects) if hasattr(dl, 'side_effects') else 'N/A'}")
    if hasattr(dl, 'drugbank_data'):
        print(f"  DrugBank CSV data rows: {len(dl.drugbank_data)}")
    if hasattr(dl, 'sider_data'):
        print(f"  SIDER CSV data rows: {len(dl.sider_data)}")

    from drug_module.interaction_engine import InteractionEngine
    ie = InteractionEngine(dl)
    inter_res = ie.check_interaction(["Aspirin", "Warfarin"])
    print(f"  Test interaction check (Aspirin + Warfarin): {inter_res}")
    
    from drug_module.side_effect_engine import SideEffectEngine
    se = SideEffectEngine(dl)
    se_res = se.get_side_effects("Metformin")
    print(f"  Test side effect check (Metformin): {se_res}")

    # Prescription module
    try:
        from prescription_module.extractor import extract_prescription_info
        p_res = extract_prescription_info("Take Amoxicillin 500mg orally twice daily for 7 days")
        print(f"\nPrescription extractor output: {p_res}")
    except Exception as e:
        print(f"\nPrescription extractor error: {e}")

if __name__ == "__main__":
    audit_everything()
