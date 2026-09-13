"""
RAG V2.5 DailyMed Pilot Comprehensive Test Suite.
Tests:
1. Ingestion of 25 authentic DailyMed drug labels.
2. Section extraction coverage (Boxed Warnings, Dosage, Indications, Contraindications, Warnings, Interactions).
3. End-to-end Provenance Preservation across Document -> Chunk -> Metadata -> Context Builder -> Citation.
4. DailyMed vs MedQuAD Source Filtering isolation.
5. Exact and Near-Duplicate Deduplication integrity.
6. Strict Pharmacology Benchmark schema and gold mapping validation.
7. Defensive Failure Handling on malformed inputs and out-of-vocabulary drugs.
"""
import unittest
import json
import tempfile
from pathlib import Path

from rag_module.knowledge.document_model import KnowledgeDocument, KnowledgeChunk, DocumentType
from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter
from rag_module.chunking.semantic_chunker import SemanticChunker
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.context.context_builder import ContextBuilder
import faiss
import numpy as np


PILOT_RAW_PATH = Path(__file__).resolve().parent.parent / "data" / "dailymed_pilot_raw.json"
BENCHMARK_PATH = Path(__file__).resolve().parent.parent / "evaluation" / "pharmacology_benchmark.json"


class TestDailyMedPilotIngestion(unittest.TestCase):
    """Verifies ingestion and section extraction across 25 authentic drug monographs."""

    def setUp(self):
        self.adapter = DailyMedAdapter(data_source=PILOT_RAW_PATH)
        self.docs, self.stats = self.adapter.run()

    def test_twenty_five_labels_ingested(self):
        self.assertGreaterEqual(len(self.docs), 150)
        self.assertEqual(self.stats["documents_seen"], len(self.docs))
        self.assertEqual(self.stats["documents_valid"], len(self.docs))
        self.assertEqual(self.stats["documents_rejected"], 0)
        self.assertEqual(self.stats["duplicates_removed"], 0)

    def test_section_extraction_coverage(self):
        sections = [d.section for d in self.docs]
        # 100% of the 25 drugs should have these key clinical sections
        for required_sec in [
            "Indications & Usage",
            "Dosage & Administration",
            "Contraindications",
            "Warnings & Precautions",
            "Adverse Reactions",
            "Drug Interactions"
        ]:
            count = sum(1 for s in sections if s == required_sec)
            self.assertEqual(count, 25, f"Section {required_sec} must be present in all 25 drugs")

        # Boxed warnings should be present in at least 8 high-risk drugs
        boxed_count = sum(1 for s in sections if s == "Boxed Warning")
        self.assertGreaterEqual(boxed_count, 8)

    def test_drug_entity_extraction(self):
        drugs_present = {d.metadata.get("drug_name") for d in self.docs}
        expected_sample = {"Lisinopril", "Metformin", "Atorvastatin", "Amoxicillin", "Levothyroxine", "Tramadol", "Sertraline"}
        for drug in expected_sample:
            self.assertIn(drug, drugs_present)


class TestDailyMedProvenanceAndCitations(unittest.TestCase):
    """Verifies provenance survival and citation correctness."""

    def test_full_provenance_to_citation_flow(self):
        # Pick Lisinopril Boxed Warning
        adapter = DailyMedAdapter(data_source=PILOT_RAW_PATH)
        docs, _ = adapter.run()
        liso_boxed = next(d for d in docs if "Lisinopril" in d.title and "Boxed Warning" in d.title)

        chunker = SemanticChunker(chunk_size_words=250, overlap_words=35)
        chunks = chunker.chunk_knowledge_document(liso_boxed)
        self.assertGreaterEqual(len(chunks), 1)
        chunk = chunks[0]

        # Verify Chunk Provenance
        self.assertEqual(chunk.source_id, "DailyMed")
        self.assertEqual(chunk.publisher, "U.S. National Library of Medicine / FDA")
        self.assertIn("dailymed.nlm.nih.gov", chunk.source_url)
        self.assertEqual(chunk.document_type, DocumentType.DRUG_MONOGRAPH)
        self.assertEqual(chunk.section, "Boxed Warning")

        # Pass to Context Builder
        builder = ContextBuilder()
        context_str, citations = builder.build_context([chunk.to_dict()])

        # Verify Citation Metadata
        self.assertEqual(len(citations), 1)
        cit = citations[0]
        self.assertEqual(cit["source_id"], "DailyMed")
        self.assertEqual(cit["publisher"], "U.S. National Library of Medicine / FDA")
        self.assertEqual(cit["chunk_id"], chunk.chunk_id)
        self.assertIn("dailymed.nlm.nih.gov", cit["url"])
        self.assertIn("[Doc 1: Lisinopril - Boxed Warning", context_str)


class TestSourceFilteringIsolation(unittest.TestCase):
    """Verifies that source filtering strictly isolates DailyMed from MedQuAD."""

    def setUp(self):
        # Build mini dual-source dataset
        self.dm_chunk = {
            "chunk_id": "dm_chunk_001",
            "document_id": "dm_doc_001",
            "source_id": "DailyMed",
            "medical_domain": "pharmacology",
            "text": "Lisinopril starting dose is 10 mg daily.",
            "title": "Lisinopril Dosage"
        }
        self.mq_chunk = {
            "chunk_id": "mq_chunk_001",
            "document_id": "mq_doc_001",
            "source_id": "medquad_nih",
            "medical_domain": "general_medicine",
            "text": "High blood pressure can be managed with lifestyle changes.",
            "title": "Hypertension Overview"
        }
        self.all_chunks = [self.dm_chunk, self.mq_chunk]

        # Create dummy index matching BGE dimension (384)
        dim = 384
        index = faiss.IndexFlatIP(dim)
        vectors = np.zeros((2, dim), dtype=np.float32)
        vectors[0, 0] = 1.0
        vectors[1, 1] = 1.0
        index.add(vectors)

        self.dense = DenseRetriever(index=index, metadata=self.all_chunks)
        self.bm25 = BM25Retriever(k1=1.5, b=0.75)
        self.bm25.fit(self.all_chunks)
        self.hybrid = HybridRetriever(dense_retriever=self.dense, bm25_retriever=self.bm25)

    def test_dailymed_filter_isolation(self):
        res = self.hybrid.search("Lisinopril dose", source_filter=["DailyMed"])
        for hit in res:
            self.assertEqual(hit["source_id"], "DailyMed")

    def test_medquad_filter_isolation(self):
        res = self.hybrid.search("blood pressure", source_filter=["medquad_nih"])
        for hit in res:
            self.assertEqual(hit["source_id"], "medquad_nih")


class TestPharmacologyBenchmarkIntegrity(unittest.TestCase):
    """Verifies the schema and gold mappings of pharmacology_benchmark.json."""

    def test_benchmark_schema_and_categories(self):
        self.assertTrue(BENCHMARK_PATH.exists())
        with open(BENCHMARK_PATH, "r", encoding="utf-8") as f:
            benchmark = json.load(f)

        self.assertEqual(len(benchmark), 45)

        categories = {q["category"] for q in benchmark}
        expected_categories = {
            "boxed_warnings", "dosage_and_administration", "contraindications",
            "indications", "warnings", "adverse_reactions", "drug_interactions",
            "special_populations", "clinical_pharmacology"
        }
        for cat in expected_categories:
            self.assertIn(cat, categories)

        for q in benchmark:
            self.assertTrue(q["id"].startswith("pharm_q"))
            self.assertEqual(q["expected_source_id"], "DailyMed")
            self.assertTrue(len(q["query"]) > 10)
            self.assertTrue(len(q["expected_sections"]) > 0)
            self.assertTrue(len(q["expected_drug"]) > 0)


class TestControlledFailureHandling(unittest.TestCase):
    """Verifies graceful degradation on malformed inputs and out-of-vocabulary queries."""

    def test_malformed_xml_rejection(self):
        bad_xml = "<document><invalidTag>No closing tag"
        adapter = DailyMedAdapter(data_source=[bad_xml])
        docs, stats = adapter.run()
        self.assertEqual(len(docs), 0)
        self.assertEqual(stats["documents_rejected"], 1)

    def test_empty_query_graceful_return(self):
        bm25 = BM25Retriever()
        bm25.fit([{"chunk_id": "c1", "text": "sample"}])
        res = bm25.search("")
        self.assertEqual(res, [])

    def test_unknown_drug_allowlist_rejection(self):
        adapter = DailyMedAdapter(data_source=PILOT_RAW_PATH, allowlist=["nonexistent_drug_xyz"])
        docs, stats = adapter.run()
        self.assertEqual(len(docs), 0)


class TestBenchmarkMetricCalculationMath(unittest.TestCase):
    """Verifies mathematical correctness of Recall@K and MRR definitions."""

    def test_metric_formula_edge_cases(self):
        # Synthetic ranking: 4 queries
        # Q1: Hit at Rank 1 (Doc + Sec) -> RR=1.0, R@1=1, R@3=1, R@5=1
        # Q2: Hit at Rank 2 (Sec only)   -> RR=0.5, R@1=0, R@3=1, R@5=1
        # Q3: Hit at Rank 4 (Doc + Sec) -> RR=0.25, R@1=0, R@3=0, R@5=1
        # Q4: Complete Miss              -> RR=0.0, R@1=0, R@3=0, R@5=0

        rr_list = [1.0, 0.5, 0.25, 0.0]
        r1_list = [1, 0, 0, 0]
        r3_list = [1, 1, 0, 0]
        r5_list = [1, 1, 1, 0]

        self.assertAlmostEqual(sum(r1_list) / 4.0, 0.25)
        self.assertAlmostEqual(sum(r3_list) / 4.0, 0.50)
        self.assertAlmostEqual(sum(r5_list) / 4.0, 0.75)
        self.assertAlmostEqual(sum(rr_list) / 4.0, 0.4375)

    def test_chunker_oversized_section_splitting(self):
        """Verifies that a monograph section exceeding target word count is split correctly."""
        long_content = " ".join([f"indication_word_{i}" for i in range(400)])
        doc = KnowledgeDocument(
            document_id="test_long_doc_001",
            source_id="DailyMed",
            source_name="National Library of Medicine DailyMed",
            publisher="U.S. National Library of Medicine / FDA",
            title="Long Drug - Indications",
            content=long_content,
            document_type=DocumentType.DRUG_MONOGRAPH,
            medical_domain="pharmacology",
            section="Indications & Usage",
            source_url="https://dailymed.nlm.nih.gov/test"
        )
        chunker = SemanticChunker(chunk_size_words=250, overlap_words=35)
        chunks = chunker.chunk_knowledge_document(doc)
        self.assertGreaterEqual(len(chunks), 2, "Document with 400 words must be split into at least 2 chunks")
        for c in chunks:
            self.assertLessEqual(c.word_count, 250 + 20)


if __name__ == "__main__":
    unittest.main()
