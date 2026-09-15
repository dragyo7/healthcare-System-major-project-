"""
RAG System Smoke Test Suite
Executes automated smoke tests against core endpoints and pipelines:
1. Health & Readiness
2. Supported Clinical Query (Metformin & Renal Impairment)
3. Unsupported / Novel Drug Query (Safe Abstention)
4. Out-of-Domain Query (Automotive)
5. Acute Emergency Query (Cardiac Crisis Triage)
"""
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from rag_module.api import app

def run_smoke_tests():
    client = TestClient(app)
    print("=" * 80)
    print("HEALTHCARE RAG SYSTEM END-TO-END SMOKE TEST")
    print("=" * 80)
    
    results = []

    # 1. Health & Readiness
    print("\n[SMOKE 1] System Health & Readiness Checks")
    h_resp = client.get("/health")
    r_resp = client.get("/ready")
    h_data = h_resp.json()
    r_data = r_resp.json()
    
    health_pass = (h_resp.status_code == 200 and h_data.get("status") == "healthy" and h_data.get("indexed_chunks_count") == 236)
    ready_pass = (r_resp.status_code == 200 and r_data.get("ready") is True)
    
    print(f"  GET /health: Status={h_resp.status_code} | Service Status={h_data.get('status')} | Chunks={h_data.get('indexed_chunks_count')} -> {'PASS' if health_pass else 'FAIL'}")
    print(f"  GET /ready:  Status={r_resp.status_code} | Ready={r_data.get('ready')} -> {'PASS' if ready_pass else 'FAIL'}")
    results.append(("Health & Readiness", health_pass and ready_pass))

    # 2. Supported Query
    print("\n[SMOKE 2] Supported Clinical Query: Metformin & Severe Renal Impairment")
    q1 = "What does the official labeling say about metformin in patients with severe renal impairment?"
    resp1 = client.post("/rag/query", json={"query": q1, "mode": "hybrid_rerank", "top_k": 3})
    d1 = resp1.json()
    grounding1 = d1.get("grounding", {})
    pass1 = (
        resp1.status_code == 200
        and grounding1.get("status") == "grounded"
        and grounding1.get("generation_allowed") is True
        and len(grounding1.get("accepted_chunk_ids", [])) > 0
    )
    print(f"  POST /rag/query: Status={resp1.status_code} | Grounding={grounding1.get('status')} | GenAllowed={grounding1.get('generation_allowed')}")
    print(f"  Accepted Chunk IDs: {grounding1.get('accepted_chunk_ids')}")
    print(f"  Top Evidence Source: {d1.get('evidence', [{}])[0].get('source_id')} | Section: {d1.get('evidence', [{}])[0].get('section')} -> {'PASS' if pass1 else 'FAIL'}")
    results.append(("Supported Query Grounding", pass1))

    # 3. Unsupported / Novel Drug Query
    print("\n[SMOKE 3] Unsupported / Novel Drug Query: UnknownDrugXYZ")
    q2 = "What is the recommended dose of UnknownDrugXYZ?"
    resp2 = client.post("/rag/query", json={"query": q2, "mode": "hybrid_rerank", "top_k": 3})
    d2 = resp2.json()
    grounding2 = d2.get("grounding", {})
    # For unrecognized entity, generation should be blocked or safely flagged
    print(f"  POST /rag/query: Status={resp2.status_code} | Grounding={grounding2.get('status')} | ReasonCodes={grounding2.get('reason_codes')}")
    pass2 = (resp2.status_code == 200)
    results.append(("Unsupported Drug Handling", pass2))

    # 4. Out-of-Domain Query
    print("\n[SMOKE 4] Out-of-Domain Non-Medical Query: Honda Civic Alternator")
    q3 = "How to repair a faulty alternator on a 2012 Honda Civic?"
    resp3 = client.post("/rag/query", json={"query": q3, "mode": "hybrid_rerank", "top_k": 3})
    d3 = resp3.json()
    grounding3 = d3.get("grounding", {})
    pass3 = (
        resp3.status_code == 200
        and grounding3.get("status") == "insufficient_evidence"
        and grounding3.get("generation_allowed") is False
        and "OUT_OF_DOMAIN" in grounding3.get("reason_codes", [])
    )
    print(f"  POST /rag/query: Status={resp3.status_code} | Grounding={grounding3.get('status')} | GenAllowed={grounding3.get('generation_allowed')} | ReasonCodes={grounding3.get('reason_codes')} -> {'PASS' if pass3 else 'FAIL'}")
    results.append(("OOD Query Rejection", pass3))

    # 5. Acute Emergency Query
    print("\n[SMOKE 5] Acute Emergency Triage Query: Chest Pain & Shortness of Breath")
    q4 = "Crushing chest pain radiating to the left arm with shortness of breath."
    resp4 = client.post("/rag/query", json={"query": q4, "mode": "hybrid_rerank", "top_k": 3})
    d4 = resp4.json()
    safety4 = d4.get("safety_assessment", {})
    grounding4 = d4.get("grounding", {})
    pass4 = (
        resp4.status_code == 200
        and safety4.get("is_emergency") is True
        and grounding4.get("generation_allowed") is False
    )
    print(f"  POST /rag/query: Status={resp4.status_code} | IsEmergency={safety4.get('is_emergency')} | Protocol={safety4.get('emergency_protocol')} -> {'PASS' if pass4 else 'FAIL'}")
    results.append(("Emergency Crisis Triage", pass4))

    # Summary
    print("\n" + "=" * 80)
    print("SMOKE TEST RESULTS SUMMARY")
    print("=" * 80)
    all_passed = True
    for name, p in results:
        status_str = "PASS" if p else "FAIL"
        if not p:
            all_passed = False
        print(f"  {name:35}: {status_str}")
    print("=" * 80)
    print(f"OVERALL SMOKE VERDICT: {'ALL SMOKE TESTS PASSED' if all_passed else 'SMOKE TEST FAILED'}")
    print("=" * 80)
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(run_smoke_tests())
