"""
Backward-Compatible Retriever Interface for Legacy Calls.
Delegates to the modern RAG Module V2 pipeline while preserving legacy function signatures.
"""
import sys
from pathlib import Path
from typing import Tuple, List

# Ensure parent directory is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline

_legacy_pipeline = None


def _get_pipeline():
    global _legacy_pipeline
    if _legacy_pipeline is None:
        _legacy_pipeline = MedicalRAGPipeline()
    return _legacy_pipeline


def clean_text(text: str) -> str:
    text = text.replace("\n", " ")
    text = " ".join(text.split())
    return text


def retrieve(query: str, k: int = 8) -> Tuple[str, List[str]]:
    """
    Legacy retrieval wrapper returning (context_str, source_names_list).
    """
    pipeline = _get_pipeline()
    result = pipeline.query(query, mode="hybrid", generate_answer=False)
    
    if result.get("abstained", False) or not result.get("sources"):
        return "No relevant medical information found.", []

    contexts = []
    sources = []
    
    # Format context from sources
    for src in result["sources"]:
        title = src.get("title", "")
        src_name = src.get("source_name", "medquad")
        url = src.get("url", "")
        sources.append(src_name)

    if pipeline.dense_retriever and result.get("sources"):
        # Extract passage text for top chunks
        chunks = pipeline.hybrid_retriever.search(query, final_k=min(k, DEFAULT_CONFIG.FINAL_TOP_K)) if pipeline.hybrid_retriever else []
        for c in chunks:
            contexts.append(clean_text(c["text"]))

    if not contexts:
        return "No relevant medical information found.", []

    return "\n\n".join(contexts[:3]), list(set(sources))


if __name__ == "__main__":
    ctx, srcs = retrieve("What is leukemia?")
    print("Context:", ctx[:200])
    print("Sources:", srcs)