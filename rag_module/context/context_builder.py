"""
Context Construction and Citation Attribution Layer.
Formats retrieved passages into numbered citation blocks with token budgeting and deduplication.
"""
import re
from typing import List, Dict, Any, Tuple
from rag_module.config.rag_config import DEFAULT_CONFIG


def compute_word_overlap(text1: str, text2: str) -> float:
    """Computes word-level Jaccard similarity between two texts with punctuation normalization."""
    words1 = set(re.findall(r'\b[a-zA-Z0-9_-]+\b', text1.lower()))
    words2 = set(re.findall(r'\b[a-zA-Z0-9_-]+\b', text2.lower()))
    if not words1 or not words2:
        return 0.0
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    return intersection / union if union > 0 else 0.0



class ContextBuilder:
    """
    Constructs clean, grounded evidence context for LLM generation.
    """
    def __init__(
        self,
        max_context_tokens: int = DEFAULT_CONFIG.MAX_CONTEXT_TOKENS,
        max_chunks: int = DEFAULT_CONFIG.FINAL_TOP_K,
        duplicate_threshold: float = 0.85
    ):
        self.max_context_tokens = max_context_tokens
        self.max_chunks = max_chunks
        self.duplicate_threshold = duplicate_threshold

    def build_context(
        self,
        retrieved_chunks: List[Dict[str, Any]]
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Deduplicates chunks, fits within context budget, and formats citations.
        Returns:
            context_str: Formatted context string with numbered source blocks.
            citations: List of structured source citation dictionaries.
        """
        if not retrieved_chunks:
            return "No relevant medical context found.", []

        selected_chunks = []
        citations = []
        accumulated_words = 0
        approx_max_words = int(self.max_context_tokens * 0.75)  # 1 token ~= 0.75 words

        for chunk in retrieved_chunks:
            chunk_text = chunk.get("text", "").strip()
            if not chunk_text:
                continue

            # Check near-duplicate overlap against already selected chunks
            is_dup = False
            for sel in selected_chunks:
                if compute_word_overlap(chunk_text, sel["text"]) >= self.duplicate_threshold:
                    is_dup = True
                    break
            if is_dup:
                continue

            word_count = len(chunk_text.split())
            if accumulated_words + word_count > approx_max_words and selected_chunks:
                # Reached context budget limit
                break

            selected_chunks.append(chunk)
            accumulated_words += word_count

            # Build structured citation
            citation_item = {
                "source_index": len(selected_chunks),
                "title": chunk.get("title") or chunk.get("focus") or chunk.get("source_name", "Medical Reference"),
                "source_id": chunk.get("source_id", "Unknown"),
                "source_name": chunk.get("source_name", "NIH Medical Knowledge Base"),
                "publisher": chunk.get("publisher", "National Institutes of Health"),
                "url": chunk.get("source_url") or chunk.get("url", ""),
                "chunk_id": chunk.get("chunk_id", ""),
                "qtype": chunk.get("qtype") or chunk.get("section", "general"),
                "score": chunk.get("rerank_score", chunk.get("fused_score", chunk.get("dense_score", 0.0)))
            }
            citations.append(citation_item)

            if len(selected_chunks) >= self.max_chunks:
                break

        if not selected_chunks:
            return "No relevant medical context found.", []

        # Format context into structured XML-delimited evidence blocks
        context_blocks = []
        for i, chunk in enumerate(selected_chunks, start=1):
            title = chunk.get("title") or chunk.get("focus", "")
            src_name = chunk.get("source_name", "Medical Source")
            url = chunk.get("source_url") or chunk.get("url", "")
            
            header = f"[Doc {i}: {title} | Source: {src_name}]"
            if url:
                header += f" (URL: {url})"
                
            block = f"{header}\n{chunk['text']}"
            context_blocks.append(block)

        formatted_context = "\n\n---\n\n".join(context_blocks)
        return formatted_context, citations
