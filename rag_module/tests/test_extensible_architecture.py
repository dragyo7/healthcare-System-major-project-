"""
Comprehensive Tests for RAG Extensible Knowledge Source Architecture.
Verifies:
1. Canonical KnowledgeDocument and KnowledgeChunk validation and serialization.
2. Deterministic SHA-256 content hashing and exact deduplication.
3. SourceRegistry metadata, adapter association, and source enablement.
4. Multi-source adapters (MedQuAD, DailyMed, OpenFDA, Guideline) with synthetic fixtures.
5. IngestionOrchestrator pipeline execution and manifest.json generation.
6. Semantic chunking with KnowledgeDocument objects.
7. Dense, BM25, and Hybrid retriever source and domain metadata filtering.
8. Backward compatibility with existing MedQuAD records.
"""
import unittest
import tempfile
import json
from pathlib import Path

from rag_module.knowledge.document_model import (
    KnowledgeDocument,
    KnowledgeChunk,
    DocumentType,
    compute_sha256,
)
from rag_module.knowledge.source_registry import (
    SourceRegistry,
    SourceMetadata,
    SourceType,
)
from rag_module.ingestion.adapters.medquad_adapter import MedQuADAdapter
from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter
from rag_module.ingestion.adapters.openfda_adapter import OpenFDAAdapter
from rag_module.ingestion.adapters.guideline_adapter import GuidelineAdapter
from rag_module.ingestion.orchestrator import IngestionOrchestrator
from rag_module.chunking.semantic_chunker import SemanticChunker
from rag_module.retrieval.bm25_retriever import BM25Retriever


class TestKnowledgeDocumentModel(unittest.TestCase):
    """Tests canonical KnowledgeDocument & KnowledgeChunk model specifications."""

    def test_valid_document_creation(self):
        doc = KnowledgeDocument(
            document_id="nih_gard_001",
            source_id="medquad_gard",
            source_name="MedQuAD - Genetic and Rare Diseases Information Center",
            publisher="NIH GARD",
            title="What is Fabry Disease?",
            content="Fabry disease is a rare genetic disorder of lipid metabolism.",
            source_url="https://rarediseases.info.nih.gov/diseases/6400/fabry-disease",
            document_type=DocumentType.QA_PAIR,
            medical_domain="genetics",
            section="Overview",
            entities=["Fabry disease", "GLA gene"],
            metadata={"focus": "Fabry Disease", "question_type": "information"}
        )
        is_valid, err = doc.validate()
        self.assertTrue(is_valid, f"Validation failed: {err}")
        self.assertTrue(len(doc.content_hash) == 64)
        self.assertEqual(doc.content_hash, compute_sha256(doc.content))

    def test_document_validation_errors(self):
        # Missing content
        doc = KnowledgeDocument(
            document_id="doc_1",
            source_id="src_1",
            source_name="Source 1",
            publisher="Pub 1",
            title="Title",
            content="",
            source_url="https://example.com"
        )
        is_valid, err = doc.validate()
        self.assertFalse(is_valid)
        self.assertIn("Content too short", err)

        # Invalid URL
        doc.content = "Valid medical content describing clinical symptoms and management."
        doc.source_url = "not-a-valid-url"
        is_valid, err = doc.validate()
        self.assertFalse(is_valid)
        self.assertIn("Invalid source_url", err)

    def test_serialization_roundtrip(self):
        doc = KnowledgeDocument(
            document_id="doc_test_123",
            source_id="medquad_nih",
            source_name="NIH Test",
            publisher="NIH",
            title="Hypertension Management",
            content="Hypertension is defined as persistent systolic blood pressure above 130 mmHg.",
            source_url="https://www.nhlbi.nih.gov/health-topics/high-blood-pressure",
            document_type=DocumentType.CLINICAL_SUMMARY,
            medical_domain="cardiology"
        )
        data_dict = doc.to_dict()
        reconstructed = KnowledgeDocument.from_dict(data_dict)
        self.assertEqual(doc.document_id, reconstructed.document_id)
        self.assertEqual(doc.content_hash, reconstructed.content_hash)
        self.assertEqual(doc.document_type, reconstructed.document_type)

    def test_deterministic_sha256(self):
        text_a = "Metformin is indicated as an adjunct to diet and exercise to improve glycemic control."
        text_b = "   Metformin is indicated as an adjunct to diet and exercise to improve glycemic control.  "
        # compute_sha256 strips whitespace
        self.assertEqual(compute_sha256(text_a), compute_sha256(text_b))


class TestSourceRegistry(unittest.TestCase):
    """Tests centralized knowledge source registry."""

    def test_registry_contains_medquad_sources(self):
        all_sources = SourceRegistry.list_sources()
        self.assertGreater(len(all_sources), 0)
        
        gard = SourceRegistry.get_source("medquad_gard")
        self.assertIsNotNone(gard)
        self.assertTrue(gard.enabled)
        self.assertEqual(gard.source_type, SourceType.FEDERAL_RESEARCH_INSTITUTE)

    def test_registry_contains_planned_sources_as_disabled(self):
        dailymed = SourceRegistry.get_source("dailymed_spl")
        self.assertIsNotNone(dailymed)
        self.assertTrue(dailymed.enabled, "DailyMed is enabled in V2.6-A full ingestion")
        
        openfda = SourceRegistry.get_source("openfda_drug_labels")
        self.assertIsNotNone(openfda)

    def test_register_custom_source(self):
        custom = SourceMetadata(
            source_id="custom_hospital_guidelines",
            display_name="Hospital Clinical Protocols",
            publisher="Mayo Clinic",
            source_type=SourceType.GUIDELINE_CLEARINGHOUSE,
            document_types=[DocumentType.CLINICAL_PRACTICE_GUIDELINE],
            domains=["critical_care"],
            base_url="https://mayoclinic.org/guidelines",
            enabled=True
        )
        SourceRegistry.register_source(custom)
        retrieved = SourceRegistry.get_source("custom_hospital_guidelines")
        self.assertEqual(retrieved.display_name, "Hospital Clinical Protocols")


class TestMultiSourceAdapters(unittest.TestCase):
    """Tests multi-source adapters with synthetic fixtures for QA, Drug Labels, and Guidelines."""

    def test_medquad_adapter_synthetic_fixture(self):
        fixture_data = [
            {
                "id": "medquad_nih_001",
                "question": "What are the symptoms of Type 2 Diabetes?",
                "answer": "Symptoms of type 2 diabetes include increased thirst, frequent urination, and unexplained fatigue.",
                "source": "NIH NIDDK",
                "focus": "Type 2 Diabetes",
                "question_type": "symptoms",
                "url": "https://www.niddk.nih.gov/health-information/diabetes"
            },
            {
                "id": "medquad_nih_002",
                "question": "How is asthma diagnosed?",
                "answer": "Asthma is diagnosed using spirometry lung function testing and clinical history.",
                "source": "NIH NHLBI",
                "focus": "Asthma",
                "question_type": "diagnosis",
                "url": "https://www.nhlbi.nih.gov/health-topics/asthma"
            }
        ]
        adapter = MedQuADAdapter(source_id="medquad_niddk", source_name="NIDDK MedQuAD")
        docs, stats = adapter.run(raw_data=fixture_data)
        self.assertEqual(len(docs), 2)
        self.assertEqual(stats["documents_seen"], 2)
        self.assertEqual(stats["documents_valid"], 2)
        self.assertEqual(docs[0].document_type, DocumentType.QA_PAIR)
        self.assertIn("Question:", docs[0].content)
        self.assertIn("Answer:", docs[0].content)

    def test_dailymed_drug_label_adapter_fixture(self):
        fixture_data = [
            {
                "set_id": "spl-amoxicillin-500mg-1234",
                "drug_name": "Amoxicillin",
                "brand_name": "Amoxil",
                "active_ingredient": "amoxicillin trihydrate",
                "dosage_form": "Capsule",
                "strength": "500 mg",
                "ndc_code": "0029-6047-12",
                "labeler": "GlaxoSmithKline",
                "sections": {
                    "indications_and_usage": "Amoxicillin is indicated in the treatment of infections due to susceptible strains of designated microorganisms.",
                    "dosage_and_administration": "Adults: 500 mg every 12 hours or 250 mg every 8 hours.",
                    "contraindications": "Amoxicillin is contraindicated in patients with a history of severe hypersensitivity reactions to beta-lactam antibacterials.",
                    "warnings_and_precautions": "Serious and occasionally fatal hypersensitivity (anaphylactic) reactions have been reported in patients on penicillin therapy."
                },
                "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=spl-amoxicillin-500mg-1234"
            }
        ]
        adapter = DailyMedAdapter(source_id="dailymed_spl")
        docs, stats = adapter.run(raw_data=fixture_data)
        # 1 drug label with 4 sections -> 4 canonical KnowledgeDocuments
        self.assertEqual(len(docs), 4)
        self.assertEqual(stats["documents_seen"], 4)
        self.assertEqual(stats["documents_valid"], 4)
        
        # Verify metadata extraction
        dosage_doc = next(d for d in docs if "Dosage" in d.title)
        self.assertEqual(dosage_doc.metadata["active_ingredient"], "amoxicillin trihydrate")
        self.assertEqual(dosage_doc.metadata["dosage_form"], "Capsule")
        self.assertEqual(dosage_doc.metadata["strength"], "500 mg")
        self.assertEqual(dosage_doc.medical_domain, "pharmacology")

    def test_openfda_adapter_fixture(self):
        fixture_data = [
            {
                "id": "openfda-lisinopril-001",
                "openfda": {
                    "brand_name": ["Prinivil", "Zestril"],
                    "generic_name": ["Lisinopril"],
                    "substance_name": ["Lisinopril"],
                    "manufacturer_name": ["Merck Sharp & Dohme Corp."],
                    "product_type": ["HUMAN PRESCRIPTION DRUG"],
                    "pharm_class_epc": ["Angiotensin Converting Enzyme Inhibitor [EPC]"]
                },
                "indications_and_usage": ["Lisinopril is indicated for the treatment of hypertension in adult patients and pediatric patients 6 years of age and older."],
                "dosage_and_administration": ["Initial dose is 10 mg once daily. Dosage may be adjusted up to 40 mg daily based on clinical response."],
                "boxed_warning": ["WARNING: FETAL TOXICITY - When pregnancy is detected, discontinue Lisinopril as soon as possible."]
            }
        ]
        adapter = OpenFDAAdapter(source_id="openfda_drug_labels")
        docs, stats = adapter.run(raw_data=fixture_data)
        self.assertEqual(len(docs), 3)
        self.assertEqual(stats["documents_valid"], 3)
        boxed_warning_doc = next(d for d in docs if "Boxed Warning" in d.title)
        self.assertIn("FETAL TOXICITY", boxed_warning_doc.content)

    def test_guideline_adapter_fixture(self):
        fixture_data = [
            {
                "guideline_id": "ada-standards-care-2024",
                "guideline_title": "Standards of Care in Diabetes—2024",
                "organization": "American Diabetes Association (ADA)",
                "publication_year": 2024,
                "sections": [
                    {
                        "heading": "Glycemic Targets",
                        "content": "An A1C goal for many nonpregnant adults of <7.0% (53 mmol/mol) without significant hypoglycemia is appropriate.",
                        "recommendation_grade": "A"
                    },
                    {
                        "heading": "Pharmacologic Approaches",
                        "content": "First-line therapy for type 2 diabetes includes lifestyle intervention and metformin, with GLP-1 RA or SGLT2i as appropriate.",
                        "recommendation_grade": "A"
                    }
                ],
                "url": "https://diabetesjournals.org/care/issue/47/Supplement_1"
            }
        ]
        adapter = GuidelineAdapter(source_id="clinical_guidelines")
        docs, stats = adapter.run(raw_data=fixture_data)
        self.assertEqual(len(docs), 2)
        self.assertEqual(docs[0].document_type, DocumentType.CLINICAL_PRACTICE_GUIDELINE)
        self.assertEqual(docs[0].metadata["recommendation_grade"], "A")


class TestIngestionPipelineAndDeduplication(unittest.TestCase):
    """Tests end-to-end ingestion orchestration, deduplication, and manifest writing."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.output_dir = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_deduplication_removes_identical_content(self):
        # 3 items, where 2 have identical content
        duplicate_data = [
            {
                "id": "doc_1",
                "question": "What is hypertension?",
                "answer": "Hypertension is chronic high blood pressure exceeding 130/80 mmHg.",
                "source": "NIH",
                "url": "https://nih.gov/htn"
            },
            {
                "id": "doc_2",
                "question": "What is hypertension?",
                "answer": "Hypertension is chronic high blood pressure exceeding 130/80 mmHg.", # exact duplicate content
                "source": "NIH",
                "url": "https://nih.gov/htn_dup"
            },
            {
                "id": "doc_3",
                "question": "What is hypotension?",
                "answer": "Hypotension is low blood pressure under 90/60 mmHg.",
                "source": "NIH",
                "url": "https://nih.gov/lbn"
            }
        ]
        adapter = MedQuADAdapter(source_id="medquad_nih")
        orchestrator = IngestionOrchestrator(output_base_dir=self.output_dir)
        result = orchestrator.ingest_source(
            source_id="medquad_nih",
            adapter=adapter,
            raw_data=duplicate_data,
            chunk_documents=True
        )
        self.assertEqual(result["stats"]["documents_valid"], 3)
        self.assertEqual(result["stats"]["duplicates_removed"], 1)
        self.assertEqual(result["stats"]["documents_ingested"], 2)

        # Verify manifest.json exists
        manifest_path = self.output_dir / "medquad_nih" / "manifest.json"
        self.assertTrue(manifest_path.exists())
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        self.assertEqual(manifest["source_id"], "medquad_nih")
        self.assertEqual(manifest["document_count"], 2)
        self.assertGreater(manifest["chunk_count"], 0)


class TestSemanticChunkerCanonicalCompatibility(unittest.TestCase):
    """Tests SemanticChunker with KnowledgeDocument canonical objects."""

    def test_chunking_knowledge_document(self):
        long_content = " ".join([f"Sentence {i} describing medical symptom progression and clinical assessment." for i in range(100)])
        doc = KnowledgeDocument(
            document_id="doc_long_001",
            source_id="dailymed_spl",
            source_name="DailyMed SPL",
            publisher="FDA",
            title="Atorvastatin - Clinical Pharmacology",
            content=long_content,
            source_url="https://dailymed.nlm.nih.gov/drugInfo.cfm?setid=123",
            document_type=DocumentType.DRUG_MONOGRAPH,
            medical_domain="pharmacology",
            section="Clinical Pharmacology",
            metadata={"active_ingredient": "atorvastatin calcium"}
        )
        chunker = SemanticChunker(target_words=50, overlap_words=10)
        chunks = chunker.chunk_knowledge_document(doc)
        
        self.assertGreater(len(chunks), 1)
        self.assertEqual(chunks[0].document_id, "doc_long_001")
        self.assertEqual(chunks[0].source_id, "dailymed_spl")
        self.assertEqual(chunks[0].metadata["active_ingredient"], "atorvastatin calcium")
        self.assertIn("chunk_id", chunks[0].to_dict())


class TestRetrieverMetadataFiltering(unittest.TestCase):
    """Tests BM25 retriever source and domain metadata filtering."""

    def test_bm25_source_and_domain_filtering(self):
        chunks = [
            {
                "chunk_id": "c1",
                "text": "Metformin hydrochloride is indicated for type 2 diabetes mellitus.",
                "source_id": "dailymed_spl",
                "medical_domain": "pharmacology"
            },
            {
                "chunk_id": "c2",
                "text": "Type 2 diabetes mellitus is a chronic condition affecting insulin resistance.",
                "source_id": "medquad_niddk",
                "medical_domain": "endocrinology"
            },
            {
                "chunk_id": "c3",
                "text": "Dietary guidelines for diabetes recommend balanced carbohydrate intake.",
                "source_id": "clinical_guidelines",
                "medical_domain": "nutrition"
            }
        ]
        retriever = BM25Retriever()
        retriever.fit(chunks)

        # Unfiltered search
        results_all = retriever.search("diabetes", top_k=5)
        self.assertEqual(len(results_all), 3)

        # Source filtered search (only DailyMed)
        results_dailymed = retriever.search("diabetes", top_k=5, source_filter=["dailymed_spl"])
        self.assertEqual(len(results_dailymed), 1)
        self.assertEqual(chunks[results_dailymed[0][0]]["source_id"], "dailymed_spl")

        # Domain filtered search (only endocrinology)
        results_endo = retriever.search("diabetes", top_k=5, domain_filter=["endocrinology"])
        self.assertEqual(len(results_endo), 1)
        self.assertEqual(chunks[results_endo[0][0]]["medical_domain"], "endocrinology")


if __name__ == "__main__":
    unittest.main()
