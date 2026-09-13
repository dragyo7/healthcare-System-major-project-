"""
RAG Module V2 Package Initialization.
Exposes the core pipeline and configuration.
"""
import sys
from pathlib import Path

# Ensure root directory is always on sys.path for robust imports
ROOT_DIR = str(Path(__file__).resolve().parent.parent)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from rag_module.config.rag_config import RAGConfig, DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline

__all__ = ["RAGConfig", "DEFAULT_CONFIG", "MedicalRAGPipeline"]
