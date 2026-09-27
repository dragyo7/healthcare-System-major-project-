"""
Unit and Integration Tests for Source Extensibility in RAG V2.6-A.
Verifies that any new/future medical knowledge source (e.g., WHO guidelines, PubMed summaries, SIDER)
can be registered, normalized, deduplicated, chunked, and indexed WITHOUT modifying any retrieval
or indexing engine core logic.
"""
import unittest
import tempfile
import json
from pathlib import Path
from typing import List, Dict, Any, Union

from rag_module.knowledge.document_model import KnowledgeDocument, DocumentType
from rag_module.knowledge.source_registry import SourceRegistry, SourceMetadata, SourceType, AuthorityLevel
from rag_module.ingestion.base_adapter import BaseSourceAdapter
from rag_module.ingestion.orchestrator import IngestionOrchestrator
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.retrieval.dense_retriever import DenseRetriever


class FakeFutureSourceAdapter(BaseSourceAdapter):
    """
    Simulated future source adapter (e.g. WHO Clinical Protocols or Future Drug Interaction Repo).
    Demonstrates true open-closed principle: extensible by registration, closed to modification.
    """
    def __init__(
        self,
        source_id: str = "WHO_Guidelines",
        source_name: str = "World Health Organization Clinical Guidelines",
        publisher: str = "World Health Organization",
        base_url: str = "https://www.who.int/publications",
        sample_guidelines: List[Dict[str, Any]] = None
    ):
        super().__init__(
            source_id=source_id,
            source_name=source_name,
            publisher=publisher,
            base_url=base_url
        )
        self.sample_guidelines = sample_guidelines or [
            {
                "guideline_id": "who_htn_2025",
                "title": "WHO Guideline for the Pharmacological Treatment of Hypertension",
                "target_condition": "Hypertension",
                "recommendation": "Initiate pharmacological treatment with ACE inhibitors, ARBs, CCBs, or thiazide diuretics in adults with systolic BP >= 140 mmHg.",
                "evidence_grade": "Strong / High Certainty",
                "url": "https://www.who.int/publications/i/item/9789240033986"
            },
            {
                "guideline_id": "who_dm2_2025",
                "title": "WHO Clinical Protocol on Type 2 Diabetes Management",
                "target_condition": "Type 2 Diabetes",
                "recommendation": "Metformin remains the initial drug of choice for the management of type 2 diabetes unless contraindicated due to severe renal impairment (eGFR < 30 mL/min).",
                "evidence_grade": "Strong / High Certainty",
                "url": "https://www.who.int/publications/i/item/9789240034001"
            }
        ]

    def load_raw_data(self) -> Any:
        return self.sample_guidelines

    def parse_and_normalize(self, raw_data: List[Dict[str, Any]]) -> List[KnowledgeDocument]:
        documents = []
        for g in raw_data:
            doc = KnowledgeDocument(
                document_id=f"who_guide_{g['guideline_id']}",
                source_id=self.source_id,
                source_name=self.source_name,
                publisher=self.publisher,
                title=g["title"],
                content=f"Guideline: {g['title']}\nCondition: {g['target_condition']}\nEvidence Grade: {g['evidence_grade']}\nRecommendation: {g['recommendation']}",
                source_url=g["url"],
                document_type=DocumentType.CLINICAL_GUIDELINE,
                medical_domain="evidence_based_guidelines",
                section="Recommendations",
                entities=[g["target_condition"]],
                version="1.0",
                metadata={
                    "evidence_grade": g["evidence_grade"],
                    "guideline_id": g["guideline_id"]
                }
            )
            documents.append(doc)
        return documents


class TestSourceExtensibility(unittest.TestCase):
    """Verifies plug-and-play addition of new medical knowledge sources."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.artifacts_dir = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_dynamic_source_registration(self):
        """Verify dynamic registration into SourceRegistry."""
        custom_meta = SourceMetadata(
            source_id="WHO_Guidelines",
            display_name="World Health Organization Clinical Guidelines",
            publisher="World Health Organization",
            source_type=SourceType.GUIDELINE_CLEARINGHOUSE,
            authority_level=AuthorityLevel.TIER_2_CLINICAL_CONSENSUS,
            document_types=["clinical_guideline"],
            domains=["global_health", "hypertension", "diabetes"],
            adapter_class="FakeFutureSourceAdapter",
            enabled=True,
            version="1.0"
        )
        SourceRegistry.register_source(custom_meta)

        retrieved = SourceRegistry.get_source("WHO_Guidelines")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.display_name, "World Health Organization Clinical Guidelines")
        self.assertEqual(retrieved.authority_level, AuthorityLevel.TIER_2_CLINICAL_CONSENSUS)

    def test_ingestion_orchestration_of_new_source(self):
        """Verify IngestionOrchestrator ingests the new source and produces valid artifacts."""
        adapter = FakeFutureSourceAdapter()
        orchestrator = IngestionOrchestrator(artifacts_root=self.artifacts_dir)

        result = orchestrator.ingest_source(
            source_id="WHO_Guidelines",
            adapter=adapter
        )

        self.assertEqual(len(result.documents), 2)
        self.assertGreaterEqual(len(result.chunks), 2)
        self.assertTrue(result.manifest_path.exists())

        # Check manifest contents
        with open(result.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest["source_id"], "WHO_Guidelines")
        self.assertEqual(manifest["document_count"], 2)
        self.assertIn("provenance_sample", manifest)
        self.assertEqual(len(manifest["provenance_sample"]), 2)

    def test_combine_multi_source_and_retrieval_filtering(self):
        """Verify combining future source with existing sources preserves provenance and enables source filtering."""
        orchestrator = IngestionOrchestrator(artifacts_root=self.artifacts_dir)
        
        # Ingest simulated source A (WHO)
        adapter_a = FakeFutureSourceAdapter(source_id="WHO_Guidelines")
        res_a = orchestrator.ingest_source("WHO_Guidelines", adapter=adapter_a)

        # Ingest simulated source B (Pharmacology Monograph)
        sample_drug = [{
            "drug_name": "TestDrug",
            "generic_name": "testdrug sodium",
            "sections": {
                "indications_and_usage": "TestDrug is indicated for acute viral syndrome.",
                "dosage_and_administration": "Take 10 mg once daily."
            }
        }]
        from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter
        adapter_b = DailyMedAdapter(source_id="DailyMed", data_source=sample_drug)
        res_b = orchestrator.ingest_source("DailyMed", adapter=adapter_b)

        # Combine
        combined_res = orchestrator.combine_sources([res_a, res_b])
        self.assertEqual(len(combined_res.documents), 4) # 2 WHO + 2 DailyMed sections
        
        # Fit BM25 on combined chunks
        bm25 = BM25Retriever()
        bm25.fit(combined_res.chunks)

        # Test source isolation filtering for WHO
        who_results = bm25.search("hypertension treatment", top_k=5, source_filter=["WHO_Guidelines"])
        self.assertTrue(len(who_results) > 0)
        for idx, score in who_results:
            chunk = bm25.metadata[idx]
            self.assertEqual(chunk["source_id"], "WHO_Guidelines")

        # Test source isolation filtering for DailyMed
        dm_results = bm25.search("viral syndrome", top_k=5, source_filter=["DailyMed"])
        self.assertTrue(len(dm_results) > 0)
        for idx, score in dm_results:
            chunk = bm25.metadata[idx]
            self.assertEqual(chunk["source_id"], "DailyMed")


if __name__ == "__main__":
    unittest.main()
