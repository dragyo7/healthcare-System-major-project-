"""
BM25 Lexical / Keyword Retriever.
Provides high-precision exact keyword matching for medical terminology,
drug trade names, dosages, and acronyms. Self-contained BM25Okapi implementation.
"""
import math
import re
import pickle
from pathlib import Path
from collections import Counter
from typing import List, Dict, Any, Tuple, Optional
from rag_module.config.rag_config import DEFAULT_CONFIG


def tokenize_medical_text(text: str) -> List[str]:
    """
    Tokenizes text for BM25 retrieval.
    Preserves numbers, dashes in drug codes, and medical terms.
    """
    if not text:
        return []
    # Tokenize words, numbers, and hyphenated terms
    tokens = re.findall(r'\b[a-zA-Z0-9_-]+\b', text.lower())
    return tokens


class BM25Retriever:
    """
    BM25Okapi inverted index retriever for medical text.
    """
    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75
    ):
        self.k1 = k1
        self.b = b
        self.corpus_size = 0
        self.avg_doc_len = 0.0
        self.doc_lengths: List[int] = []
        self.doc_freqs: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
        self.doc_term_freqs: List[Counter] = []
        self.metadata: List[Dict[str, Any]] = []

    def fit(self, chunks: List[Dict[str, Any]]):
        """Builds BM25 inverted index from chunk metadata."""
        self.metadata = chunks
        self.corpus_size = len(chunks)
        self.doc_lengths = []
        self.doc_term_freqs = []
        self.doc_freqs = Counter()

        total_len = 0
        for chunk in chunks:
            tokens = tokenize_medical_text(chunk["text"])
            doc_len = len(tokens)
            self.doc_lengths.append(doc_len)
            total_len += doc_len
            
            tf = Counter(tokens)
            self.doc_term_freqs.append(tf)
            for term in tf.keys():
                self.doc_freqs[term] += 1

        self.avg_doc_len = (total_len / self.corpus_size) if self.corpus_size > 0 else 0.0

        # Calculate Robertson-Spärck Jones IDF
        self.idf = {}
        for term, df in self.doc_freqs.items():
            # Standard Lucene/Okapi smoothed IDF
            self.idf[term] = math.log(1.0 + (self.corpus_size - df + 0.5) / (df + 0.5))

    def search(
        self,
        query: str,
        top_k: int = DEFAULT_CONFIG.BM25_CANDIDATE_K,
        source_filter: Optional[List[str]] = None,
        domain_filter: Optional[List[str]] = None
    ) -> List[Tuple[int, float]]:
        """
        Searches corpus for query, returning list of (chunk_idx, bm25_score) pairs.
        Supports optional filtering by source_id and medical_domain.
        """
        query_tokens = tokenize_medical_text(query)
        if not query_tokens or self.corpus_size == 0:
            return []

        scores = [0.0] * self.corpus_size

        for term in query_tokens:
            if term not in self.idf:
                continue
            idf_val = self.idf[term]
            
            for doc_idx, tf_map in enumerate(self.doc_term_freqs):
                if term not in tf_map:
                    continue
                tf = tf_map[term]
                doc_len = self.doc_lengths[doc_idx]
                
                # BM25 Okapi term score
                numerator = tf * (self.k1 + 1.0)
                denominator = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avg_doc_len))
                scores[doc_idx] += idf_val * (numerator / denominator)

        source_set = {s.lower() for s in source_filter} if source_filter else None
        domain_set = {d.lower() for d in domain_filter} if domain_filter else None
        medquad_subsources = {'medquad_generic', 'cancergov', 'niddk', 'cdc', 'gard', 'ninds', 'nhlbi', 'ghr', 'seniorhealth', 'medquad'}

        # Filter and rank documents
        candidates = []
        for i in range(self.corpus_size):
            if scores[i] <= 0.0:
                continue
            if self.metadata and i < len(self.metadata):
                meta = self.metadata[i]
                if source_set:
                    doc_source = str(meta.get("source_id", "")).lower()
                    is_match = doc_source in source_set
                    if not is_match and any(s in ["medquad", "medquad_nih"] for s in source_set):
                        is_match = doc_source in medquad_subsources
                    if not is_match:
                        continue
                if domain_set and str(meta.get("medical_domain", "")).lower() not in domain_set:
                    continue
            candidates.append(i)

        ranked_indices = sorted(
            candidates,
            key=lambda i: scores[i],
            reverse=True
        )[:top_k]

        return [(idx, scores[idx]) for idx in ranked_indices]

    def save(self, file_path: Path):
        """Serializes BM25 index to disk."""
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, file_path: Path) -> "BM25Retriever":
        """Loads BM25 index from disk."""
        with open(file_path, "rb") as f:
            return pickle.load(f)
