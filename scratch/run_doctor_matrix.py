import requests

queries = [
    # 1. Clinical pharmacology query in English
    {
        "query": "What is lisinopril indicated for?",
        "lang": "en",
        "expected_grounded": True,
        "expected_mode": "hybrid"
    },
    # 2. Multilingual Clinical Pharmacology Query in Hindi
    {
        "query": "मेटफॉर्मिन 500mg के क्या दुष्प्रभाव हैं?",
        "lang": "hi",
        "expected_grounded": True,
        "expected_mode": "hybrid"
    },
    # 3. Deterministic Drug-Drug Interaction in Doctor mode
    {
        "query": "Patient is on Warfarin 5mg daily. Can I co-prescribe Aspirin 81mg for antiplatelet therapy?",
        "lang": "en",
        "expected_grounded": True,
        "has_interactions": True
    },
    # 4. Emergency Diversion in Doctor mode
    {
        "query": "Patient collapsed with severe crushing chest pain radiating to left arm and cyanosis",
        "lang": "en",
        "expected_status": "emergency_diverted"
    },
    # 5. Unsupported Fictitious Drug (Fail-Closed)
    {
        "query": "What are the contraindications of Cardiorexol 50mg in renal failure?",
        "lang": "en",
        "expected_status": "abstained_policy"
    }
]

print("=== EMPIRICAL EVALUATION MATRIX (DOCTOR CDS MODE) ===")
passed_count = 0

for item in queries:
    q = item["query"]
    lang = item["lang"]
    payload = {
        "clinical_query": q,
        "mode": "doctor",
        "language": lang
    }
    r = requests.post("http://127.0.0.1:8000/cds/evaluate", json=payload, timeout=120)
    data = r.json()
    status = data.get("verification_status")
    ans_snippet = (data.get("answer", "") or "").replace("\n", " ")[:90]
    interactions = data.get("drug_interactions", [])
    citations = data.get("citations", [])

    ok = True
    if "expected_status" in item and status != item["expected_status"]:
        ok = False
    if "expected_grounded" in item and not data.get("is_grounded"):
        ok = False
    if item.get("has_interactions") and len(interactions) == 0:
        ok = False

    if ok:
        passed_count += 1
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] \"{q[:45]}...\" ({lang})")
    print(f"       Status: {status} | Grounded: {data.get('is_grounded')} | Citations: {len(citations)} | Alerts: {len(interactions)}")
    print(f"       Answer: {ans_snippet}...")

print(f"\nTotal Doctor CDS Passed: {passed_count}/{len(queries)} ({passed_count/len(queries)*100:.1f}%)")
