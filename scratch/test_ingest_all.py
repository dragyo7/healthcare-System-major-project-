"""
Verification test for ingesting all verified sources via IngestionOrchestrator.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from rag_module.ingestion.orchestrator import IngestionOrchestrator
from rag_module.knowledge.source_registry import SourceRegistry

def main():
    orchestrator = IngestionOrchestrator()
    sources = ["DailyMed", "MedlinePlus", "ICMR", "MoHFW_STG", "RxNorm"]
    
    results = []
    print("=== MULTI-SOURCE INGESTION VERIFICATION ===")
    for sid in sources:
        res = orchestrator.ingest_source(source_id=sid)
        print(f"[{sid}] Docs: {len(res.documents)}, Chunks: {len(res.chunks)}")
        assert len(res.documents) > 0, f"Source {sid} produced 0 documents!"
        assert len(res.chunks) > 0, f"Source {sid} produced 0 chunks!"
        # Verify provenance of first document
        doc = res.documents[0]
        assert doc.provenance_status == "VERIFIED", f"Doc {doc.document_id} provenance is not VERIFIED!"
        assert doc.source_url.startswith("http"), f"Doc {doc.document_id} URL is invalid: {doc.source_url}"
        results.append(res)

    print("\n=== COMBINING ALL SOURCES INTO UNIFIED ARTIFACTS ===")
    combined_res = orchestrator.combine_sources(results)
    print(f"Total Combined Docs: {len(combined_res.documents)}, Chunks: {len(combined_res.chunks)}")
    print(f"Combined Manifest: {combined_res.manifest_path}")

if __name__ == "__main__":
    main()
