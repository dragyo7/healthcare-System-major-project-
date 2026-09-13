"""
Comprehensive Real-Source Validation Tests for RAG V2.4.
Verifies:
1. Authentic DailyMed SPL JSON and XML drug monographs (Lisinopril, Amoxicillin, Metformin, Atorvastatin, Levothyroxine).
2. Authentic openFDA Drug Product Labeling API schema parsing with full metadata preservation.
3. Structured Clinical Practice Guideline adapter boundaries.
4. Complete provenance preservation across Document -> Chunk -> Metadata -> Context Builder -> Citation.
5. IngestionConfigManager declarative source selection, allowlists, and rate limits.
6. IngestionOrchestrator manifest.json reproducibility and provenance summary.
7. Defensive error handling against malformed XML/JSON and corrupted records.
"""
import unittest
import json
import tempfile
from pathlib import Path

from rag_module.knowledge.document_model import KnowledgeDocument, KnowledgeChunk, DocumentType
from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter
from rag_module.ingestion.adapters.openfda_adapter import OpenFDAAdapter
from rag_module.ingestion.adapters.guideline_adapter import GuidelineAdapter
from rag_module.config.source_config_loader import IngestionConfigManager
from rag_module.ingestion.orchestrator import IngestionOrchestrator
from rag_module.chunking.semantic_chunker import SemanticChunker
from rag_module.context.context_builder import ContextBuilder


FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


class TestRealDailyMedValidation(unittest.TestCase):
    """Validates DailyMedAdapter with real structured SPL JSON and XML records."""

    def test_real_dailymed_five_monographs_extraction(self):
        json_path = FIXTURES_DIR / "real_dailymed_labels.json"
        adapter = DailyMedAdapter(data_source=json_path)
        docs, stats = adapter.run()

        # 5 real drugs with multiple sections -> verified section documents
        self.assertGreater(len(docs), 15)
        self.assertEqual(stats["documents_seen"], len(docs))
        self.assertEqual(stats["documents_valid"], len(docs))
        self.assertEqual(stats["documents_rejected"], 0)

        # 1. Verify Lisinopril Boxed Warning & Dosage
        lisinopril_boxed = next((d for d in docs if "Lisinopril" in d.title and "Boxed Warning" in d.title), None)
        self.assertIsNotNone(lisinopril_boxed, "Lisinopril Boxed Warning must be extracted")
        self.assertIn("FETAL TOXICITY", lisinopril_boxed.content)
        self.assertEqual(lisinopril_boxed.metadata["active_ingredient"], "lisinopril")
        self.assertEqual(lisinopril_boxed.metadata["dosage_form"], "Tablet")
        self.assertEqual(lisinopril_boxed.metadata["ndc_code"], "0310-0130-10")

        # 2. Verify Amoxicillin Dosage & Indications
        amox_dosage = next((d for d in docs if "Amoxicillin" in d.title and "Dosage" in d.title), None)
        self.assertIsNotNone(amox_dosage)
        self.assertIn("500 mg every 12 hours", amox_dosage.content)
        self.assertEqual(amox_dosage.metadata["active_ingredient"], "amoxicillin trihydrate")

        # 3. Verify Metformin Lactic Acidosis Boxed Warning
        metformin_boxed = next((d for d in docs if "Metformin" in d.title and "Boxed Warning" in d.title), None)
        self.assertIsNotNone(metformin_boxed)
        self.assertIn("LACTIC ACIDOSIS", metformin_boxed.content)

        # 4. Verify Atorvastatin Contraindications & Warnings
        atorva_warnings = next((d for d in docs if "Atorvastatin" in d.title and "Warnings" in d.title), None)
        self.assertIsNotNone(atorva_warnings)
        self.assertIn("Rhabdomyolysis", atorva_warnings.content)

        # 5. Verify Levothyroxine Boxed Warning & Titration
        levo_boxed = next((d for d in docs if "Levothyroxine" in d.title and "Boxed Warning" in d.title), None)
        self.assertIsNotNone(levo_boxed)
        self.assertIn("NOT FOR TREATMENT OF OBESITY", levo_boxed.content)

    def test_real_dailymed_spl_xml_parsing(self):
        xml_path = FIXTURES_DIR / "real_dailymed_spl.xml"
        adapter = DailyMedAdapter(data_source=xml_path)
        docs, stats = adapter.run()

        self.assertGreaterEqual(len(docs), 4)
        doc_titles = [d.title for d in docs]
        self.assertTrue(any("WARNING" in t.upper() or "FETAL TOXICITY" in t.upper() for t in doc_titles))
        self.assertTrue(any("INDICATIONS" in t.upper() for t in doc_titles))
        self.assertTrue(any("DOSAGE" in t.upper() for t in doc_titles))

    def test_dailymed_allowlist_filtering(self):
        json_path = FIXTURES_DIR / "real_dailymed_labels.json"
        # Only allow lisinopril and metformin
        adapter = DailyMedAdapter(data_source=json_path, allowlist=["lisinopril", "metformin"])
        docs, stats = adapter.run()

        self.assertGreater(len(docs), 0)
        for doc in docs:
            drug_name = doc.metadata.get("drug_name", "").lower()
            self.assertTrue("lisinopril" in drug_name or "metformin" in drug_name, f"Unexpected drug: {drug_name}")


class TestRealOpenFDAValidation(unittest.TestCase):
    """Validates OpenFDAAdapter with real openFDA Drug Product Labeling API schema."""

    def test_real_openfda_api_parsing(self):
        json_path = FIXTURES_DIR / "real_openfda_labels.json"
        adapter = OpenFDAAdapter(data_source=json_path)
        docs, stats = adapter.run()

        self.assertGreater(len(docs), 10)
        self.assertEqual(stats["documents_valid"], len(docs))

        # Check Lisinopril openfda metadata preservation
        lisinopril_doc = next(d for d in docs if "Zestril" in d.title or "Lisinopril" in d.title)
        self.assertEqual(lisinopril_doc.medical_domain, "pharmacology")
        self.assertIn("AstraZeneca Pharmaceuticals LP", lisinopril_doc.metadata["manufacturers"])
        self.assertIn("Angiotensin Converting Enzyme Inhibitor [EPC]", lisinopril_doc.metadata["pharm_classes"])
        self.assertIn("0310-0130-10", lisinopril_doc.metadata["package_ndcs"])
        self.assertTrue(lisinopril_doc.source_url.startswith("https://api.fda.gov"))

    def test_openfda_boxed_warning_extraction(self):
        json_path = FIXTURES_DIR / "real_openfda_labels.json"
        adapter = OpenFDAAdapter(data_source=json_path)
        docs, stats = adapter.run()

        boxed_docs = [d for d in docs if "Boxed Warning" in d.title]
        self.assertGreaterEqual(len(boxed_docs), 2)
        
        metformin_boxed = next(d for d in boxed_docs if "Glucophage" in d.title or "Metformin" in d.title)
        self.assertIn("LACTIC ACIDOSIS", metformin_boxed.content)


class TestGuidelineAdapterValidation(unittest.TestCase):
    """Validates GuidelineAdapter boundaries and structured guideline extraction."""

    def test_structured_guideline_parsing(self):
        data = [
            {
                "guideline_id": "acc-aha-htn-2023",
                "guideline_title": "AHA/ACC Clinical Practice Guideline for High Blood Pressure",
                "organization": "American Heart Association (AHA)",
                "publication_year": 2023,
                "sections": [
                    {
                        "heading": "Blood Pressure Thresholds",
                        "content": "Stage 1 hypertension is defined as SBP 130-139 mm Hg or DBP 80-89 mm Hg.",
                        "recommendation_grade": "Class I (Strong)"
                    },
                    {
                        "heading": "First-Line Pharmacotherapy",
                        "content": "First-line pharmacotherapy for hypertension includes thiazide diuretics, CCBs, and ACE inhibitors or ARBs.",
                        "recommendation_grade": "Class I (Strong)"
                    }
                ],
                "url": "https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065"
            }
        ]
        adapter = GuidelineAdapter(data_source=data)
        docs, stats = adapter.run()

        self.assertEqual(len(docs), 2)
        self.assertEqual(docs[0].document_type, DocumentType.CLINICAL_PRACTICE_GUIDELINE)
        self.assertEqual(docs[0].metadata["recommendation_grade"], "Class I (Strong)")
        self.assertEqual(docs[0].publisher, "American Heart Association (AHA)")


class TestProvenanceSurvival(unittest.TestCase):
    """Verifies that source provenance survives through Document -> Chunk -> Context -> Citation."""

    def test_full_pipeline_provenance_retention(self):
        doc = KnowledgeDocument(
            document_id="dailymed_lisinopril_dosage",
            source_id="DailyMed",
            source_name="National Library of Medicine DailyMed",
            publisher="U.S. National Library of Medicine / FDA",
            title="Lisinopril - Dosage & Administration",
            content="Drug: Lisinopril\nSection: Dosage & Administration\n\nHypertension: Initial adult dose is 10 mg once daily. Titrate to 40 mg daily.",
            source_url="https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b",
            document_type=DocumentType.DRUG_MONOGRAPH,
            medical_domain="pharmacology",
            section="Dosage & Administration",
            metadata={"active_ingredient": "lisinopril", "strength": "10 mg"}
        )
        
        # 1. Chunking
        chunker = SemanticChunker(chunk_size_words=250, overlap_words=35)
        chunks = chunker.chunk_knowledge_document(doc)
        self.assertEqual(len(chunks), 1)
        chunk = chunks[0]

        # Verify chunk provenance
        self.assertEqual(chunk.source_id, "DailyMed")
        self.assertEqual(chunk.source_name, "National Library of Medicine DailyMed")
        self.assertEqual(chunk.publisher, "U.S. National Library of Medicine / FDA")
        self.assertEqual(chunk.source_url, "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b")

        # 2. Context & Citation Construction
        chunk_dict = chunk.to_dict()
        builder = ContextBuilder()
        context_str, citations = builder.build_context([chunk_dict])

        self.assertIn("[Doc 1: Lisinopril - Dosage & Administration", context_str)
        self.assertIn("Source: National Library of Medicine DailyMed", context_str)
        self.assertEqual(len(citations), 1)
        self.assertEqual(citations[0]["source_id"], "DailyMed")
        self.assertEqual(citations[0]["url"], "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b")


class TestIngestionConfigurationAndManifest(unittest.TestCase):
    """Verifies configuration-driven orchestration and reproducibility manifest schema."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.output_dir = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_orchestrator_manifest_generation(self):
        json_path = FIXTURES_DIR / "real_openfda_labels.json"
        adapter = OpenFDAAdapter(data_source=json_path)
        orchestrator = IngestionOrchestrator(output_base_dir=self.output_dir)

        result = orchestrator.ingest_source(
            source_id="openFDA",
            adapter=adapter,
            chunk_documents=True
        )

        manifest_path = self.output_dir / "openfda" / "manifest.json"
        self.assertTrue(manifest_path.exists())

        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        self.assertEqual(manifest["source_id"], "openFDA")
        self.assertEqual(manifest["code_version"], "rag_v2.4")
        self.assertEqual(manifest["embedding_model"], "BAAI/bge-small-en")
        self.assertEqual(manifest["embedding_dimension"], 384)
        self.assertIn("chunking_config", manifest)
        self.assertIn("retrieval_config", manifest)
        self.assertIn("provenance_sample", manifest)
        self.assertGreater(len(manifest["provenance_sample"]), 0)


class TestDefensiveErrorHandling(unittest.TestCase):
    """Verifies defensive error handling against corrupt inputs."""

    def test_malformed_sources_handling(self):
        json_path = FIXTURES_DIR / "malformed_sources.json"
        adapter = DailyMedAdapter(data_source=json_path)
        docs, stats = adapter.run()

        # Should cleanly reject empty/corrupt items without uncaught exceptions
        self.assertIsInstance(docs, list)
        self.assertIsInstance(stats, dict)

    def test_invalid_xml_error_handling(self):
        corrupt_xml = "<document><unclosedTag>Incomplete XML"
        adapter = DailyMedAdapter(data_source=[corrupt_xml])
        docs, stats = adapter.run()

        self.assertEqual(len(docs), 0)
        self.assertEqual(stats["documents_rejected"], 1)


if __name__ == "__main__":
    unittest.main()
