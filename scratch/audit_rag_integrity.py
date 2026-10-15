import os
import sys
sys.path.insert(0, os.path.abspath("."))
import pickle
import faiss
from rag_module.config.rag_config import RAGConfig
cfg = RAGConfig()
index_path = cfg.FAISS_INDEX_PATH
meta_path = cfg.METADATA_PATH

print("=== FAISS & METADATA INTEGRITY AUDIT ===")
print("FAISS Index Path:", index_path, os.path.exists(index_path))
print("Metadata Path:", meta_path, os.path.exists(meta_path))

index = faiss.read_index(str(index_path))
print("FAISS ntotal (vector count):", index.ntotal)
print("FAISS dimension:", index.d)
print("FAISS metric type:", index.metric_type, "(0 = METRIC_INNER_PRODUCT, 1 = METRIC_L2)")

with open(str(meta_path), "rb") as f:
    meta = pickle.load(f)

print("Metadata chunk count:", len(meta))
print("Vector count == Metadata count:", index.ntotal == len(meta))

# Sample first 5 chunks
print("\n--- SAMPLE METADATA CHUNKS ---")
for i in range(min(5, len(meta))):
    c = meta[i]
    cid = c.get("chunk_id")
    did = c.get("document_id") or c.get("doc_id")
    title = c.get("title")
    src = c.get("source_name") or c.get("source_id") or c.get("publisher")
    content_len = len(c.get("text", ""))
    print(f"Chunk [{i}]: ID={cid[:35]}... | Title={title} | Source={src} | CharCount={content_len}")

# Verify duplicate chunk IDs or empty content
chunk_ids = [c.get("chunk_id") for c in meta]
print("\nUnique chunk IDs:", len(set(chunk_ids)), "out of", len(chunk_ids))
empty_chunks = [i for i, c in enumerate(meta) if not c.get("text", "").strip()]
print("Empty content chunks:", len(empty_chunks))

# Source distribution
source_counts = {}
for c in meta:
    s = c.get("source_id") or c.get("source_name") or "Unknown"
    source_counts[s] = source_counts.get(s, 0) + 1
print("Source distribution:", source_counts)
