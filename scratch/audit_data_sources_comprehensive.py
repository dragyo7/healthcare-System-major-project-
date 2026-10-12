import os
import sys
sys.path.insert(0, os.path.abspath("."))
import json
import pickle
import faiss
import numpy as np

def run_comprehensive_audit():
    print("==================================================")
    print("1. DEEP INSPECTION OF PRODUCTION INDEX & METADATA")
    print("==================================================")

    prod_faiss_path = "rag_module/data/faiss_index/index_v2.bin"
    prod_meta_pkl = "rag_module/data/faiss_index/meta_v2.pkl"
    prod_meta_json = "rag_module/data/faiss_index/meta_v2.json"
    prod_bm25_pkl = "rag_module/data/faiss_index/bm25_index.pkl"

    # FAISS
    faiss_index = faiss.read_index(prod_faiss_path)
    print(f"FAISS Total Vectors: {faiss_index.ntotal}")
    print(f"FAISS Dimension: {faiss_index.d}")
    print(f"FAISS Is Trained: {faiss_index.is_trained}")

    # Metadata PKL
    with open(prod_meta_pkl, "rb") as f:
        meta_pkl = pickle.load(f)
    print(f"meta_v2.pkl Records: {len(meta_pkl)}")

    # Metadata JSON
    with open(prod_meta_json, "r", encoding="utf-8") as f:
        meta_json = json.load(f)
    print(f"meta_v2.json Records: {len(meta_json)}")

    # BM25 PKL
    with open(prod_bm25_pkl, "rb") as f:
        bm25_obj = pickle.load(f)
    
    # Analyze BM25
    bm25_corpus_size = getattr(bm25_obj, "corpus_size", None)
    if bm25_corpus_size is None and hasattr(bm25_obj, "doc_len"):
        bm25_corpus_size = len(bm25_obj.doc_len)
    elif isinstance(bm25_obj, dict):
        bm25_corpus_size = len(bm25_obj.get("corpus", bm25_obj.get("documents", [])))
    print(f"BM25 Corpus Size: {bm25_corpus_size}")

    # Verify ID alignment
    pkl_chunk_ids = [item.get("chunk_id") for item in meta_pkl]
    json_chunk_ids = [item.get("chunk_id") for item in meta_json]
    
    print(f"PKL == JSON chunk_ids exact match: {pkl_chunk_ids == json_chunk_ids}")
    print(f"Unique chunk IDs in PKL: {len(set(pkl_chunk_ids))}")
    print(f"Duplicates in PKL: {len(pkl_chunk_ids) - len(set(pkl_chunk_ids))}")

    # Breakdown by source
    source_stats = {}
    for i, rec in enumerate(meta_pkl):
        src = rec.get("source_name") or rec.get("source") or "UNKNOWN"
        src_id = rec.get("source_id", "N/A")
        pub = rec.get("publisher", "N/A")
        doc_id = rec.get("document_id") or rec.get("doc_id", "N/A")
        title = rec.get("title", "N/A")
        url = rec.get("source_url") or rec.get("url", "N/A")

        if src not in source_stats:
            source_stats[src] = {
                "source_id": src_id,
                "publisher": pub,
                "chunk_count": 0,
                "doc_ids": set(),
                "titles": set(),
                "urls": set(),
                "sample_chunk_id": rec.get("chunk_id"),
                "sample_title": title,
                "sample_url": url,
                "sample_section": rec.get("section", "N/A"),
                "has_text": bool(rec.get("text")),
                "avg_words": []
            }
        source_stats[src]["chunk_count"] += 1
        source_stats[src]["doc_ids"].add(doc_id)
        source_stats[src]["titles"].add(title)
        source_stats[src]["urls"].add(url)
        source_stats[src]["avg_words"].append(rec.get("word_count", len(rec.get("text", "").split())))

    print("\n--- Production Corpus Breakdown ---")
    for src, st in source_stats.items():
        avg_w = sum(st["avg_words"]) / len(st["avg_words"]) if st["avg_words"] else 0
        print(f"\nSource Name: {src}")
        print(f"  Source ID: {st['source_id']}")
        print(f"  Publisher: {st['publisher']}")
        print(f"  Chunks: {st['chunk_count']}")
        print(f"  Unique Documents: {len(st['doc_ids'])}")
        print(f"  Unique Titles: {len(st['titles'])}")
        print(f"  Unique URLs: {len(st['urls'])}")
        print(f"  Avg Word Count: {avg_w:.1f}")
        print(f"  Sample Title: {st['sample_title']}")
        print(f"  Sample Section: {st['sample_section']}")
        print(f"  Sample URL: {st['sample_url']}")

    print("\n==================================================")
    print("2. CHECKING ALL KNOWLEDGE BASES IN data/ & rag_module/data/")
    print("==================================================")

    kb_paths = {
        "data/knowledge_bases/dailymed/dailymed_essential_spl.json": "data/knowledge_bases/dailymed/dailymed_essential_spl.json",
        "data/knowledge_bases/icmr/icmr_guidelines.json": "data/knowledge_bases/icmr/icmr_guidelines.json",
        "data/knowledge_bases/medlineplus/medlineplus_topics.json": "data/knowledge_bases/medlineplus/medlineplus_topics.json",
        "data/knowledge_bases/mohfw_stg/mohfw_stgs.json": "data/knowledge_bases/mohfw_stg/mohfw_stgs.json",
        "data/knowledge_bases/rxnorm/rxnorm_prescribable.json": "data/knowledge_bases/rxnorm/rxnorm_prescribable.json",
        "rag_module/data/dailymed_raw.json": "rag_module/data/dailymed_raw.json",
        "rag_module/data/dailymed_pilot_raw.json": "rag_module/data/dailymed_pilot_raw.json",
        "data/normalized/expanded_production_chunks.json": "data/normalized/expanded_production_chunks.json"
    }

    for name, p in kb_paths.items():
        if os.path.exists(p):
            sz = os.path.getsize(p)
            try:
                with open(p, "r", encoding="utf-8") as f:
                    content = json.load(f)
                if isinstance(content, list):
                    print(f"File: {p} ({sz} bytes) -> List of {len(content)} items")
                    if len(content) > 0:
                        print(f"   Sample item keys: {list(content[0].keys()) if isinstance(content[0], dict) else type(content[0])}")
                elif isinstance(content, dict):
                    print(f"File: {p} ({sz} bytes) -> Dict with {len(content)} keys: {list(content.keys())[:10]}")
            except Exception as e:
                print(f"File: {p} ({sz} bytes) -> Error loading json: {e}")
        else:
            print(f"File: {p} NOT FOUND")

    print("\n==================================================")
    print("3. CHECKING ARTIFACT FOLDERS IN rag_module/data/artifacts/")
    print("==================================================")
    artifact_dirs = ["combined", "dailymed", "dailymed_pilot", "icmr", "medlineplus", "medquad", "mohfw_stg", "openfda", "rxnorm"]
    for ad in artifact_dirs:
        dir_p = os.path.join("rag_module/data/artifacts", ad)
        if os.path.exists(dir_p):
            files = os.listdir(dir_p)
            print(f"\nArtifact Dir: {dir_p} ({len(files)} files)")
            for f in files:
                fp = os.path.join(dir_p, f)
                fsz = os.path.getsize(fp)
                # Inspect chunks.json or corpus.json or manifest.json
                extra = ""
                if f.endswith(".json") and fsz > 0 and fsz < 10000000:
                    try:
                        with open(fp, "r", encoding="utf-8") as jf:
                            jdata = json.load(jf)
                            if isinstance(jdata, list):
                                extra = f" -> list of {len(jdata)} items"
                            elif isinstance(jdata, dict):
                                extra = f" -> dict with {len(jdata)} keys"
                    except Exception as ex:
                        extra = f" -> error: {ex}"
                elif f.endswith(".json") and fsz >= 10000000:
                    extra = " -> (large file > 10MB)"
                print(f"   {f} ({fsz} bytes){extra}")
        else:
            print(f"Artifact Dir: {dir_p} NOT FOUND")

    print("\n==================================================")
    print("4. CHECKING drug_module & prescription_module DATA")
    print("==================================================")
    # drug_module
    dm_files = [
        "drug_module/datasets/drugbank.csv",
        "drug_module/datasets/sider.csv",
        "data/rules/medication_interactions/medication_interactions.json",
        "data/rules/medication_interactions/medication_side_effects.json"
    ]
    for df in dm_files:
        if os.path.exists(df):
            sz = os.path.getsize(df)
            print(f"Drug file: {df} ({sz} bytes)")
            if df.endswith(".csv"):
                with open(df, "r", encoding="utf-8") as f:
                    lines = [line.strip() for line in f if line.strip()]
                print(f"   CSV lines: {len(lines)}")
                if len(lines) > 0:
                    print(f"   Header: {lines[0]}")
                    if len(lines) > 1:
                        print(f"   Sample row 1: {lines[1]}")
            elif df.endswith(".json"):
                with open(df, "r", encoding="utf-8") as f:
                    j = json.load(f)
                if isinstance(j, list):
                    print(f"   JSON list: {len(j)} records")
                    if len(j) > 0:
                        print(f"   Sample record: {j[0]}")
                elif isinstance(j, dict):
                    print(f"   JSON dict: {len(j)} keys: {list(j.keys())[:5]}")
        else:
            print(f"Drug file: {df} NOT FOUND")

    # prescription_module
    pm_files = [
        "prescription_module/data/dataset.json",
        "prescription_module/data/drug_list.json"
    ]
    for pf in pm_files:
        if os.path.exists(pf):
            sz = os.path.getsize(pf)
            print(f"Prescription file: {pf} ({sz} bytes)")
            if sz > 0:
                with open(pf, "r", encoding="utf-8") as f:
                    j = json.load(f)
                print(f"   JSON content: {len(j)} items/keys: {j if len(str(j)) < 200 else list(j)[:10]}")
            else:
                print("   WARNING: EMPTY FILE (0 bytes)")
        else:
            print(f"Prescription file: {pf} NOT FOUND")

if __name__ == "__main__":
    run_comprehensive_audit()
