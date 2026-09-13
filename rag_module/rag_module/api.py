"""
Backward-Compatible FastAPI Endpoint Wrapper.
Exposes /chat routed to the modern RAG V2 pipeline.
"""
import sys
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.rag_pipeline import MedicalRAGPipeline

app = FastAPI(title="Medical RAG API (Legacy Compatibility Layer)")
_pipeline = None


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        _pipeline = MedicalRAGPipeline()
    return _pipeline


class QueryRequest(BaseModel):
    query: str


@app.post("/chat")
def chat(request: QueryRequest):
    pipeline = get_pipeline()
    result = pipeline.query(request.query, mode="hybrid", generate_answer=True)
    return {
        "question": request.query,
        "answer": result["answer"],
        "is_emergency": result.get("is_emergency", False),
        "abstained": result.get("abstained", False),
        "sources": [s["source_name"] for s in result.get("sources", [])]
    }