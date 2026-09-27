"""
Unit tests for IncrementalIndexer.
Verifies vector caching, fingerprinting, and zero redundant re-encodings on identical/partial updates.
"""
import shutil
import tempfile
import unittest
from pathlib import Path

from rag_module.indexing.incremental_indexer import IncrementalIndexer, compute_chunk_fingerprint


class TestIncrementalIndexer(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.index_path = self.temp_dir / "index.bin"
        self.meta_pkl = self.temp_dir / "meta.pkl"
        self.meta_json = self.temp_dir / "meta.json"
        self.bm25_path = self.temp_dir / "bm25.pkl"
        self.cache_dir = self.temp_dir / "cache"
        self.cache_dir.mkdir()

        self.initial_chunks = [
            {
                "chunk_id": "chunk_001",
                "doc_id": "doc_lisinopril",
                "source_id": "DailyMed",
                "text": "Lisinopril is contraindicated in patients with hereditary angioedema or pregnancy.",
                "metadata": {"section": "Contraindications", "drug_name": "Lisinopril"}
            },
            {
                "chunk_id": "chunk_002",
                "doc_id": "doc_metformin",
                "source_id": "DailyMed",
                "text": "Metformin carries a boxed warning for lactic acidosis especially in severe renal impairment.",
                "metadata": {"section": "Boxed Warning", "drug_name": "Metformin"}
            },
            {
                "chunk_id": "chunk_003",
                "doc_id": "doc_icmr_htn",
                "source_id": "ICMR",
                "text": "ICMR guideline recommends starting with ACE inhibitors or ARBs for stage 1 hypertension.",
                "metadata": {"section": "Treatment", "drug_name": "General"}
            }
        ]

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_first_build_encodes_all_chunks(self):
        indexer = IncrementalIndexer(cache_dir=self.cache_dir)
        stats = indexer.sync_index(
            chunks=self.initial_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )
        self.assertEqual(stats["total_chunks"], 3)
        self.assertEqual(stats["re_encoded_chunks"], 3)
        self.assertEqual(stats["reused_chunks"], 0)
        self.assertTrue(self.index_path.exists())
        self.assertTrue(self.bm25_path.exists())

    def test_identical_sync_reuses_all_chunks(self):
        indexer = IncrementalIndexer(cache_dir=self.cache_dir)
        # First sync
        indexer.sync_index(
            chunks=self.initial_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )

        # Second sync with exact same chunks
        stats2 = indexer.sync_index(
            chunks=self.initial_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )
        self.assertEqual(stats2["total_chunks"], 3)
        self.assertEqual(stats2["re_encoded_chunks"], 0)
        self.assertEqual(stats2["reused_chunks"], 3)

    def test_single_chunk_addition(self):
        indexer = IncrementalIndexer(cache_dir=self.cache_dir)
        indexer.sync_index(
            chunks=self.initial_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )

        new_chunks = list(self.initial_chunks)
        new_chunks.append({
            "chunk_id": "chunk_004",
            "doc_id": "doc_warfarin",
            "source_id": "DailyMed",
            "text": "Warfarin interacts with NSAIDs causing severe bleeding risks.",
            "metadata": {"section": "Drug Interactions", "drug_name": "Warfarin"}
        })

        stats = indexer.sync_index(
            chunks=new_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )
        self.assertEqual(stats["total_chunks"], 4)
        self.assertEqual(stats["re_encoded_chunks"], 1)
        self.assertEqual(stats["reused_chunks"], 3)

    def test_single_chunk_modification(self):
        indexer = IncrementalIndexer(cache_dir=self.cache_dir)
        indexer.sync_index(
            chunks=self.initial_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )

        modified_chunks = list(self.initial_chunks)
        # Modify chunk 2 text
        modified_chunks[1] = {
            "chunk_id": "chunk_002",
            "doc_id": "doc_metformin",
            "source_id": "DailyMed",
            "text": "Metformin carries an updated boxed warning for lactic acidosis in renal and hepatic failure.",
            "metadata": {"section": "Boxed Warning", "drug_name": "Metformin"}
        }

        stats = indexer.sync_index(
            chunks=modified_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )
        self.assertEqual(stats["total_chunks"], 3)
        self.assertEqual(stats["re_encoded_chunks"], 1)
        self.assertEqual(stats["reused_chunks"], 2)

    def test_persisted_cache_reload(self):
        indexer1 = IncrementalIndexer(cache_dir=self.cache_dir)
        indexer1.sync_index(
            chunks=self.initial_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )

        # Fresh instance pointing to same cache directory
        indexer2 = IncrementalIndexer(cache_dir=self.cache_dir)
        stats = indexer2.sync_index(
            chunks=self.initial_chunks,
            index_save_path=self.index_path,
            meta_save_path=self.meta_pkl,
            meta_json_path=self.meta_json,
            bm25_save_path=self.bm25_path
        )
        self.assertEqual(stats["total_chunks"], 3)
        self.assertEqual(stats["re_encoded_chunks"], 0)
        self.assertEqual(stats["reused_chunks"], 3)


if __name__ == "__main__":
    unittest.main()
