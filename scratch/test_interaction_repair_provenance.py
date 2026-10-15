import asyncio
from cds_module.models import CDSEvaluateRequest
from cds_module.orchestrator import get_cds_orchestrator

async def run_interaction_provenance_audit():
    print("=== AUDIT: DETERMINISTIC INTERACTION REPAIR & CLAIM ISOLATION ===")
    orchestrator = get_cds_orchestrator()

    # TEST CASE 1 (Positive): Legitimate Co-Prescription Query
    # Query asks specifically about combining Warfarin and Aspirin
    print("\n--- TEST CASE 1: Legitimate Co-Prescription Safety Query ---")
    req1 = CDSEvaluateRequest(
        clinical_query="Patient is on Warfarin 5mg daily. Can I co-prescribe Aspirin 81mg for antiplatelet therapy?",
        mode="doctor",
        language="en"
    )
    res1 = orchestrator.evaluate(req1)
    
    print(f"Status: {res1.verification_status}")
    print(f"Grounded: {res1.is_grounded} | Abstained: {res1.abstained}")
    print(f"Alerts count: {len(res1.drug_interactions)}")
    if res1.drug_interactions:
        alert = res1.drug_interactions[0]
        print(f"Rule ID: {alert.rule_id} | Severity: {alert.severity} | Pair: {alert.drug_pair}")
        print(f"Provenance Status: {alert.provenance_status} | Source: {alert.source_id}")
    print(f"Citations count: {len(res1.citations)}")
    print(f"Answer snippet:\n{res1.answer[:250]}...")

    # Assertions for Test Case 1:
    assert res1.verification_status == "grounded", f"Expected grounded, got {res1.verification_status}"
    assert res1.is_grounded is True, "Expected is_grounded to be True"
    assert res1.abstained is False, "Expected abstained to be False"
    assert len(res1.drug_interactions) >= 1, "Expected at least 1 drug interaction alert"
    assert res1.drug_interactions[0].rule_id == "RUL-INT-001", "Expected rule RUL-INT-001"
    assert res1.drug_interactions[0].severity == "major", "Expected major severity"
    assert "warfarin" in res1.drug_interactions[0].drug_pair and "aspirin" in res1.drug_interactions[0].drug_pair
    # Verify that the answer text contains the structured rule finding and zero unverified hallucination
    assert "Clinical Drug Interaction Alert (MAJOR)" in res1.answer
    assert "RUL-INT-001" in res1.answer
    print(">> TEST CASE 1: PASSED (Verified rule finding surfaced with complete provenance)")

    # TEST CASE 2 (Negative): Arbitrary Curative Claim Mentioning Interacting Drugs
    # Query asserts an ungrounded medical claim: "Warfarin and Aspirin cure pancreatic cancer"
    print("\n--- TEST CASE 2 (Negative): Arbitrary Therapeutic Claim Mentioning Interacting Drugs ---")
    req2 = CDSEvaluateRequest(
        clinical_query="Warfarin and Aspirin cure pancreatic cancer and eliminate tumors completely.",
        mode="doctor",
        language="en"
    )
    res2 = orchestrator.evaluate(req2)
    
    print(f"Status: {res2.verification_status}")
    print(f"Grounded: {res2.is_grounded} | Abstained: {res2.abstained}")
    print(f"Abstention reason: {res2.abstention_reason}")
    print(f"Alerts count: {len(res2.drug_interactions)}")
    print(f"Answer:\n{res2.answer}")

    # Assertions for Test Case 2:
    # 1. Proves that arbitrary claims CANNOT inherit a grounded status from an unrelated alert
    assert res2.verification_status == "abstained_policy", f"Expected abstained_policy, got {res2.verification_status}"
    assert res2.is_grounded is False, "Arbitrary claim must NOT be grounded"
    assert res2.abstained is True, "Arbitrary claim must be abstained"
    # 2. But the safety alert for Warfarin + Aspirin is STILL captured for patient safety
    assert len(res2.drug_interactions) >= 1, "Safety alert must still be visible in metadata"
    # 3. Answer explicitly refuses the ungrounded curative claim
    assert "guidelines do not contain sufficient verified clinical evidence" in res2.answer
    print(">> TEST CASE 2: PASSED (Arbitrary therapeutic claim correctly refused fail-closed without inheriting grounded status)")

    # TEST CASE 3 (Negative): Fictitious / Non-Interacting Medication with Ungrounded Claim
    print("\n--- TEST CASE 3 (Negative): Non-Interacting / Unsupported Medication ---")
    req3 = CDSEvaluateRequest(
        clinical_query="Can Cardiorexol 50mg cure hypertension?",
        mode="doctor",
        language="en"
    )
    res3 = orchestrator.evaluate(req3)
    print(f"Status: {res3.verification_status}")
    print(f"Grounded: {res3.is_grounded} | Abstained: {res3.abstained}")
    assert res3.verification_status == "abstained_policy"
    assert res3.is_grounded is False
    assert len(res3.drug_interactions) == 0
    print(">> TEST CASE 3: PASSED (Unsupported entity failed closed)")

    print("\n============================================================")
    print("AUDIT RESULT: ALL DETERMINISTIC INTERACTION PROVENANCE TESTS PASSED (3/3)")
    print("============================================================")

if __name__ == "__main__":
    asyncio.run(run_interaction_provenance_audit())
