"""
Source-Agnostic Ingestion Orchestration Pipeline.
Orchestrates loading, normalization, validation, deduplication, chunking,
and manifest generation across multiple medical knowledge sources.
"""
import os
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Type
from datetime import datetime, timezone

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.knowledge.document_model import KnowledgeDocument, KnowledgeChunk, compute_sha256
from rag_module.knowledge.source_registry import SourceRegistry, SourceMetadata
from rag_module.ingestion.base_adapter import BaseSourceAdapter
from rag_module.ingestion.adapters.medquad_adapter import MedQuADAdapter
from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter
from rag_module.ingestion.adapters.openfda_adapter import OpenFDAAdapter
from rag_module.ingestion.adapters.guideline_adapter import GuidelineAdapter
from rag_module.ingestion.adapters.medlineplus_adapter import MedlinePlusAdapter
from rag_module.ingestion.adapters.icmr_adapter import ICMRAdapter
from rag_module.ingestion.adapters.mohfw_adapter import MoHFWAdapter
from rag_module.ingestion.adapters.rxnorm_adapter import RxNormAdapter
from rag_module.chunking.semantic_chunker import SemanticChunker


from rag_module.config.source_config_loader import IngestionConfigManager, SourceExecutionConfig


ADAPTER_MAP: Dict[str, Type[BaseSourceAdapter]] = {
    "MedQuADAdapter": MedQuADAdapter,
    "DailyMedAdapter": DailyMedAdapter,
    "MedlinePlusAdapter": MedlinePlusAdapter,
    "ICMRAdapter": ICMRAdapter,
    "MoHFWAdapter": MoHFWAdapter,
    "RxNormAdapter": RxNormAdapter,
    "OpenFDAAdapter": OpenFDAAdapter,
    "GuidelineAdapter": GuidelineAdapter
}


class IngestionResult:
    """Encapsulates the output and telemetry of an ingestion run."""
    def __init__(
        self,
        source_id: str,
        documents: List[KnowledgeDocument],
        chunks: List[Dict[str, Any]],
        stats: Dict[str, Any],
        manifest_path: Optional[Path] = None
    ):
        self.source_id = source_id
        self.documents = documents
        self.chunks = chunks
        self.stats = stats
        self.manifest_path = manifest_path

    def __getitem__(self, key: str) -> Any:
        if hasattr(self, key):
            return getattr(self, key)
        raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "document_count": len(self.documents),
            "chunk_count": len(self.chunks),
            "stats": self.stats,
            "manifest_path": str(self.manifest_path) if self.manifest_path else None
        }


class IngestionOrchestrator:
    """
    Source-agnostic, configuration-driven ingestion engine.
    """
    def __init__(
        self,
        artifacts_root: Optional[Path] = None,
        output_base_dir: Optional[Path] = None,
        config_manager: Optional[IngestionConfigManager] = None,
        chunk_size_words: int = DEFAULT_CONFIG.CHUNK_SIZE_WORDS,
        overlap_words: int = DEFAULT_CONFIG.CHUNK_OVERLAP_WORDS
    ):
        self.artifacts_root = output_base_dir or artifacts_root or DEFAULT_CONFIG.ARTIFACTS_DIR
        self.config_manager = config_manager or IngestionConfigManager()
        self.chunker = SemanticChunker(
            chunk_size_words=chunk_size_words,
            overlap_words=overlap_words,
            min_chunk_char_len=DEFAULT_CONFIG.MIN_CHUNK_CHAR_LEN
        )

    def get_adapter_for_source(self, source_id: str, custom_source_data: Optional[Any] = None) -> BaseSourceAdapter:
        """Instantiates the appropriate adapter for a given source ID using configuration."""
        meta = SourceRegistry.get_source(source_id)
        scfg = self.config_manager.get_source_config(source_id)
        allowlist = scfg.allowlist if scfg else None

        adapter_cls_name = meta.adapter_class if meta else "MedQuADAdapter"
        adapter_cls = ADAPTER_MAP.get(adapter_cls_name, MedQuADAdapter)

        if adapter_cls is MedQuADAdapter:
            return MedQuADAdapter()
        elif adapter_cls is DailyMedAdapter:
            return DailyMedAdapter(data_source=custom_source_data, allowlist=allowlist)
        elif adapter_cls is MedlinePlusAdapter:
            return MedlinePlusAdapter(data_source=custom_source_data)
        elif adapter_cls is ICMRAdapter:
            return ICMRAdapter(data_source=custom_source_data)
        elif adapter_cls is MoHFWAdapter:
            return MoHFWAdapter(data_source=custom_source_data)
        elif adapter_cls is RxNormAdapter:
            return RxNormAdapter(data_source=custom_source_data)
        elif adapter_cls is OpenFDAAdapter:
            return OpenFDAAdapter(data_source=custom_source_data, allowlist=allowlist)
        elif adapter_cls is GuidelineAdapter:
            return GuidelineAdapter(data_source=custom_source_data, source_id=source_id)
        return adapter_cls()

    def ingest_source(
        self,
        source_id: str,
        adapter: Optional[BaseSourceAdapter] = None,
        raw_data: Optional[Any] = None,
        custom_source_data: Optional[Any] = None,
        chunk_documents: bool = True,
        output_dir: Optional[Path] = None
    ) -> IngestionResult:
        """
        Runs ingestion for a single knowledge source:
        1. Adapter extraction & normalization into KnowledgeDocument objects
        2. Deduplication via SHA-256 content hashes
        3. Semantic chunking
        4. Artifact persistence and comprehensive Manifest generation
        """
        t0 = time.time()
        meta = SourceRegistry.get_source(source_id)
        display_name = meta.display_name if meta else source_id

        print(f"\n[Ingestion] Starting ingestion for source: {display_name} ({source_id})")
        if adapter is None:
            adapter = self.get_adapter_for_source(source_id, custom_source_data)
        
        # 1. Run adapter normalization
        documents, raw_stats = adapter.run(raw_data=raw_data)
        print(f"[Ingestion] Normalized {len(documents)} valid documents.")

        # 2. Semantic Chunking
        chunks = []
        if chunk_documents and documents:
            doc_dicts = [doc.to_dict() for doc in documents]
            chunks = self.chunker.chunk_corpus(doc_dicts)
            print(f"[Ingestion] Generated {len(chunks)} semantic chunks.")

        # 3. Setup Artifact Directory
        target_dir = output_dir or (self.artifacts_root / source_id.lower())
        target_dir.mkdir(parents=True, exist_ok=True)

        corpus_save_path = target_dir / "corpus.json"
        chunks_save_path = target_dir / "chunks.json"
        manifest_save_path = target_dir / "manifest.json"

        with open(corpus_save_path, "w", encoding="utf-8") as f:
            json.dump([d.to_dict() for d in documents], f, indent=2)

        with open(chunks_save_path, "w", encoding="utf-8") as f:
            json.dump(chunks, f, indent=2)

        duration_sec = round(time.time() - t0, 3)

        # 4. Generate Comprehensive Reproducibility Manifest
        manifest_stats = adapter.get_statistics()
        manifest_stats["documents_ingested"] = len(documents)

        manifest = {
            "source_id": source_id,
            "source_display_name": display_name,
            "publisher": meta.publisher if meta else "Unknown",
            "authority_level": meta.authority_level if meta else "tier_3_general_reference",
            "ingestion_timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": duration_sec,
            "corpus_version": meta.version if meta else "2.4",
            "code_version": "rag_v2.4",
            "document_count": len(documents),
            "chunk_count": len(chunks),
            "embedding_model": DEFAULT_CONFIG.EMBEDDING_MODEL_NAME,
            "embedding_dimension": DEFAULT_CONFIG.EMBEDDING_DIMENSION,
            "chunking_config": {
                "chunk_size_words": self.chunker.chunk_size_words,
                "overlap_words": self.chunker.overlap_words,
                "min_chunk_char_len": self.chunker.min_chunk_char_len
            },
            "retrieval_config": {
                "hybrid_rrf_k": DEFAULT_CONFIG.HYBRID_RRF_K,
                "dense_k": DEFAULT_CONFIG.DENSE_CANDIDATE_K,
                "bm25_k": DEFAULT_CONFIG.BM25_CANDIDATE_K,
                "reranker_model": DEFAULT_CONFIG.RERANKER_MODEL_NAME
            },
            "stats": manifest_stats,
            "corpus_file": str(corpus_save_path.name),
            "chunks_file": str(chunks_save_path.name),
            "content_hash_summary": compute_sha256("".join(d.content_hash for d in documents[:100])) if documents else "",
            "provenance_sample": [
                {
                    "document_id": doc.document_id,
                    "title": doc.title,
                    "url": doc.source_url,
                    "hash": doc.content_hash[:12]
                }
                for doc in documents[:5]
            ]
        }

        with open(manifest_save_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        print(f"[Ingestion] Source '{source_id}' completed in {duration_sec}s. Manifest written to: {manifest_save_path}")

        return IngestionResult(
            source_id=source_id,
            documents=documents,
            chunks=chunks,
            stats=manifest["stats"],
            manifest_path=manifest_save_path
        )

    def ingest_all(
        self,
        source_ids: Optional[List[str]] = None,
        combine: bool = True
    ) -> IngestionResult:
        """
        Ingests all specified (or default authoritative) sources and optionally combines them.
        """
        if source_ids is None:
            source_ids = ["DailyMed", "MedlinePlus", "ICMR", "MoHFW_STG", "RxNorm"]
        
        results: List[IngestionResult] = []
        for sid in source_ids:
            try:
                res = self.ingest_source(source_id=sid)
                results.append(res)
            except Exception as e:
                print(f"[Ingestion] Warning: Failed to ingest source '{sid}': {e}")
                
        if combine and results:
            return self.combine_sources(results)
        elif results:
            return results[0]
        else:
            raise RuntimeError("No sources were successfully ingested.")

    def combine_sources(
        self,
        results: List[IngestionResult],
        output_dir: Optional[Path] = None
    ) -> IngestionResult:
        """
        Combines multiple IngestionResult objects into a unified multi-source corpus,
        saving combined artifacts to artifacts/combined/ (or custom output_dir).
        """
        target_dir = output_dir or (self.artifacts_root / "combined")
        target_dir.mkdir(parents=True, exist_ok=True)

        combined_docs: List[KnowledgeDocument] = []
        combined_chunks: List[Dict[str, Any]] = []
        source_breakdown = {}

        for res in results:
            combined_docs.extend(res.documents)
            combined_chunks.extend(res.chunks)
            source_breakdown[res.source_id] = {
                "document_count": len(res.documents),
                "chunk_count": len(res.chunks),
                "stats": res.stats
            }

        corpus_save_path = target_dir / "corpus.json"
        chunks_save_path = target_dir / "chunks.json"
        manifest_save_path = target_dir / "manifest.json"

        with open(corpus_save_path, "w", encoding="utf-8") as f:
            json.dump([d.to_dict() for d in combined_docs], f, indent=2)

        with open(chunks_save_path, "w", encoding="utf-8") as f:
            json.dump(combined_chunks, f, indent=2)

        manifest = {
            "source_id": "combined",
            "source_display_name": "Multi-Source Unified Knowledge Base",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "corpus_version": "2.6",
            "document_count": len(combined_docs),
            "chunk_count": len(combined_chunks),
            "sources": list(source_breakdown.keys()),
            "source_breakdown": source_breakdown,
            "embedding_model": DEFAULT_CONFIG.EMBEDDING_MODEL_NAME,
            "embedding_dimension": DEFAULT_CONFIG.EMBEDDING_DIMENSION,
            "chunking_config": {
                "chunk_size_words": self.chunker.chunk_size_words,
                "overlap_words": self.chunker.overlap_words,
                "min_chunk_char_len": self.chunker.min_chunk_char_len
            },
            "corpus_file": str(corpus_save_path.name),
            "chunks_file": str(chunks_save_path.name)
        }

        with open(manifest_save_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        print(f"[Ingestion] Combined {len(results)} sources: {len(combined_docs)} documents, {len(combined_chunks)} chunks.")
        print(f"[Ingestion] Combined manifest written to: {manifest_save_path}")

        return IngestionResult(
            source_id="combined",
            documents=combined_docs,
            chunks=combined_chunks,
            stats={"sources": source_breakdown, "total_documents": len(combined_docs), "total_chunks": len(combined_chunks)},
            manifest_path=manifest_save_path
        )


# Alias for backward and forward compatibility
MultiSourceOrchestrator = IngestionOrchestrator

