"""
RAG V2.5.1 Phase 1: DailyMed Chunking Forensic Audit.
Calculates exact chunk distribution, percentiles, min/max, section breakdown,
and evaluates chunking policy compliance.
"""
import json
import sys
from pathlib import Path
from collections import defaultdict
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.chunking.semantic_chunker import SemanticChunker, count_words


def audit_chunking():
    corpus_path = Path("rag_module/data/artifacts/dailymed_pilot/corpus.json")
    chunks_path = Path("rag_module/data/artifacts/dailymed_pilot/chunks.json")

    with open(corpus_path, "r", encoding="utf-8") as f:
        corpus = json.load(f)

    with open(chunks_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    total_docs = len(corpus)
    total_chunks = len(chunks)

    # Word and char lengths
    word_lengths = [count_words(c["text"]) for c in chunks]
    char_lengths = [len(c["text"]) for c in chunks]

    # Sections breakdown
    section_chunks = defaultdict(list)
    section_docs = defaultdict(list)

    for c in chunks:
        sec = c.get("section", "Unknown")
        section_chunks[sec].append(c)

    for d in corpus:
        sec = d.get("section", "Unknown")
        section_docs[sec].append(d)

    # Calculate percentiles
    w_min = int(np.min(word_lengths))
    w_max = int(np.max(word_lengths))
    w_mean = float(np.mean(word_lengths))
    w_median = float(np.median(word_lengths))
    w_p25 = float(np.percentile(word_lengths, 25))
    w_p75 = float(np.percentile(word_lengths, 75))
    w_p90 = float(np.percentile(word_lengths, 90))
    w_p95 = float(np.percentile(word_lengths, 95))

    c_min = int(np.min(char_lengths))
    c_max = int(np.max(char_lengths))
    c_mean = float(np.mean(char_lengths))
    c_median = float(np.median(char_lengths))

    chunks_below_min = sum(1 for c in char_lengths if c < DEFAULT_CONFIG.MIN_CHUNK_CHAR_LEN)
    chunks_above_target = sum(1 for w in word_lengths if w > DEFAULT_CONFIG.CHUNK_SIZE_WORDS)

    # Document to chunks count
    doc_chunk_counts = defaultdict(int)
    for c in chunks:
        doc_chunk_counts[c["document_id"]] += 1

    single_chunk_docs = sum(1 for cnt in doc_chunk_counts.values() if cnt == 1)
    multi_chunk_docs = sum(1 for cnt in doc_chunk_counts.values() if cnt > 1)

    print("=== DAILYMED CHUNKING FORENSIC AUDIT ===")
    print(f"Total KnowledgeDocuments: {total_docs}")
    print(f"Total KnowledgeChunks: {total_chunks}")
    print(f"Chunks per Document: {total_chunks / total_docs:.2f}")
    print(f"Documents with Exactly 1 Chunk: {single_chunk_docs} ({single_chunk_docs/total_docs*100:.1f}%)")
    print(f"Documents Split into Multiple Chunks: {multi_chunk_docs} ({multi_chunk_docs/total_docs*100:.1f}%)")
    print(f"Configured Target Chunk Size: {DEFAULT_CONFIG.CHUNK_SIZE_WORDS} words")
    print(f"Configured Chunk Overlap: {DEFAULT_CONFIG.CHUNK_OVERLAP_WORDS} words")
    print(f"Configured Min Char Length: {DEFAULT_CONFIG.MIN_CHUNK_CHAR_LEN} chars")

    print("\n--- Word Count Statistics ---")
    print(f"  Min Words:    {w_min}")
    print(f"  Max Words:    {w_max}")
    print(f"  Mean Words:   {w_mean:.2f}")
    print(f"  Median Words: {w_median:.2f}")
    print(f"  p25 Words:    {w_p25:.2f}")
    print(f"  p75 Words:    {w_p75:.2f}")
    print(f"  p90 Words:    {w_p90:.2f}")
    print(f"  p95 Words:    {w_p95:.2f}")

    print("\n--- Character Count Statistics ---")
    print(f"  Min Chars:    {c_min}")
    print(f"  Max Chars:    {c_max}")
    print(f"  Mean Chars:   {c_mean:.2f}")
    print(f"  Median Chars: {c_median:.2f}")

    print("\n--- Boundary Violations ---")
    print(f"  Chunks Below Min Char Length ({DEFAULT_CONFIG.MIN_CHUNK_CHAR_LEN}): {chunks_below_min}")
    print(f"  Chunks Above Target Words ({DEFAULT_CONFIG.CHUNK_SIZE_WORDS}): {chunks_above_target}")

    print("\n--- Section Breakdown ---")
    print(f"{'Section Name':<30} | {'Docs':<5} | {'Chunks':<6} | {'Mean W':<8} | {'Min W':<6} | {'Max W':<6}")
    print("-" * 72)
    for sec in sorted(section_docs.keys()):
        d_cnt = len(section_docs[sec])
        c_cnt = len(section_chunks[sec])
        sec_words = [count_words(c["text"]) for c in section_chunks[sec]]
        s_mean = np.mean(sec_words) if sec_words else 0
        s_min = np.min(sec_words) if sec_words else 0
        s_max = np.max(sec_words) if sec_words else 0
        print(f"{sec:<30} | {d_cnt:<5} | {c_cnt:<6} | {s_mean:<8.1f} | {s_min:<6} | {s_max:<6}")

    # Inspect the longest sections
    print("\n--- Top 3 Longest Chunks in Corpus ---")
    sorted_chunks = sorted(chunks, key=lambda c: count_words(c["text"]), reverse=True)
    for i, c in enumerate(sorted_chunks[:3], 1):
        w = count_words(c["text"])
        print(f"{i}. [{c['document_id']}] ({w} words) - {c['title']}")
        print(f"   Excerpt: {c['text'][:120]}...\n")


if __name__ == "__main__":
    audit_chunking()
