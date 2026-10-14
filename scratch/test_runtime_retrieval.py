import sys
import os
import json

sys.path.insert(0, os.path.abspath("."))

from rag_module.service import RAGService, RAGQueryRequest, RetrievalMode

def test_queries():
    print("Initializing RAGService...")
    service = RAGService()
    
    test_queries = [
        # DailyMed queries
        ("What is metformin and what are its indications?", "DailyMed"),
        ("What are the adverse effects and warnings for atorvastatin?", "DailyMed"),
        ("What is the dosage and administration for lisinopril?", "DailyMed"),
        
        # MedlinePlus queries
        ("What are the symptoms and causes of type 2 diabetes?", "MedlinePlus"),
        ("What is pneumonia and how is it diagnosed?", "MedlinePlus"),
        
        # ICMR queries
        ("What are the ICMR diagnostic criteria and thresholds for diabetes in India?", "ICMR"),
        ("What are the ICMR guidelines for community acquired pneumonia empiric therapy?", "ICMR"),
        
        # MoHFW STG queries
        ("What is the MoHFW standard treatment guideline protocol for hypertension at primary health centre?", "MoHFW_STG"),
        ("What is the emergency management protocol for acute hypoglycemia under MoHFW STG?", "MoHFW_STG")
    ]

    results_table = []

    print("\n========================================================")
    print("RUNNING LIVE RETRIEVAL TEST FOR EACH SOURCE")
    print("========================================================")

    for query, target_source in test_queries:
        print(f"\nQuery: {query}")
        print(f"Target Source: {target_source}")
        
        req = RAGQueryRequest(
            query=query,
            mode=RetrievalMode.HYBRID,
            top_k=5
        )
        
        resp = service.retrieve(req)
        
        top_chunk = resp.evidence[0] if resp.evidence else None
        
        if top_chunk:
            ret_src = top_chunk.source_name
            ret_src_id = top_chunk.source_id
            ret_title = top_chunk.title
            ret_chunk_id = top_chunk.chunk_id
            ret_score = top_chunk.score
            ret_rank = top_chunk.rank
            ret_url = top_chunk.source_url
            print(f"  Top Retrieved Source: {ret_src} ({ret_src_id})")
            print(f"  Top Title: {ret_title}")
            print(f"  Chunk ID: {ret_chunk_id}")
            print(f"  Score: {ret_score:.4f}, Rank: {ret_rank}")
            print(f"  Dense Score: {top_chunk.dense_score}, BM25 Score: {top_chunk.bm25_score}, RRF Score: {top_chunk.fused_score}, Rerank Score: {top_chunk.rerank_score}")
            print(f"  URL: {ret_url}")
        else:
            ret_src = "NONE"
            ret_title = "NONE"
            ret_chunk_id = "NONE"
            print("  NO CHUNKS RETRIEVED")
            
        grounding_status = resp.grounding.status.value if resp.grounding else "N/A"
        print(f"  Total Retrieved Evidence: {resp.total_evidence}")
        print(f"  Grounding Status: {grounding_status}")
        
        results_table.append({
            "query": query,
            "target": target_source,
            "retrieved_source_id": top_chunk.source_id if top_chunk else "NONE",
            "retrieved_source_name": top_chunk.source_name if top_chunk else "NONE",
            "title": top_chunk.title if top_chunk else "NONE",
            "chunk_id": top_chunk.chunk_id if top_chunk else "NONE",
            "grounding_status": grounding_status
        })

    print("\n\n========================================================")
    print("SUMMARY TABLE OF RUNTIME RETRIEVAL RESULTS")
    print("========================================================")
    print(f"{'Query':<55} | {'Target':<12} | {'Retrieved Source':<15} | {'Title':<45} | {'Grounding'}")
    print("-" * 145)
    for r in results_table:
        print(f"{r['query'][:53]:<55} | {r['target']:<12} | {r['retrieved_source_id']:<15} | {r['title'][:43]:<45} | {r['grounding_status']}")

if __name__ == "__main__":
    test_queries()
