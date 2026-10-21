"""
evaluate_ddi_comprehensive.py

Comprehensive DDI Evaluation Suite.
Measures:
- Sensitivity (Recall) on supported drug pairs, brand aliases, and combination medicines
- Specificity and False Positive rate on known negative controls (compatible pairs)
- True Negative handling and Duplicate active ingredient detection
- Abstention behavior and safety invariants on unknown / out-of-domain drug pairs
- Patient allergy conflict detection and cross-reactivity mapping

CRITICAL SAFETY INVARIANT:
An absent local rule must NEVER be treated as proof of safety.
Unknown pairs MUST trigger 'no_matching_local_rule' or partial coverage abstentions, NEVER 'safe'.
"""

import sys
import os
import json
import urllib.request
import urllib.error
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))


BENCHMARK_DATASET = [
    # -------------------------------------------------------------------------
    # CATEGORY A: Supported True Positives (Known Canonical DDI Pairs)
    # -------------------------------------------------------------------------
    {
        "id": "DDI-TP-001",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "aspirin",
        "active": ["warfarin"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-001",
        "expected_severity": "major",
        "clinical_note": "Aspirin + Warfarin synergistic bleeding risk"
    },
    {
        "id": "DDI-TP-002",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "ibuprofen",
        "active": ["warfarin"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-002",
        "expected_severity": "major",
        "clinical_note": "Ibuprofen + Warfarin severe GI hemorrhage risk"
    },
    {
        "id": "DDI-TP-003",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "lisinopril",
        "active": ["ibuprofen"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-003",
        "expected_severity": "moderate",
        "clinical_note": "Lisinopril + Ibuprofen renal blunting and hyperkalemia"
    },
    {
        "id": "DDI-TP-004",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "amoxicillin",
        "active": ["methotrexate"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-004",
        "expected_severity": "major",
        "clinical_note": "Amoxicillin + Methotrexate reduced renal tubular clearance"
    },
    {
        "id": "DDI-TP-005",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "metformin",
        "active": ["alcohol"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-005",
        "expected_severity": "major",
        "clinical_note": "Metformin + Alcohol life-threatening lactic acidosis"
    },
    {
        "id": "DDI-TP-006",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "paracetamol",
        "active": ["alcohol"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-006",
        "expected_severity": "major",
        "clinical_note": "Paracetamol + Alcohol acute severe hepatotoxicity"
    },
    {
        "id": "DDI-TP-007",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "clarithromycin",
        "active": ["atorvastatin"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-007",
        "expected_severity": "major",
        "clinical_note": "Clarithromycin + Atorvastatin CYP3A4 myopathy / rhabdomyolysis"
    },
    {
        "id": "DDI-TP-008",
        "category": "KNOWN_INTERACTION_CANONICAL",
        "candidate": "omeprazole",
        "active": ["clopidogrel"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-008",
        "expected_severity": "major",
        "clinical_note": "Omeprazole + Clopidogrel CYP2C19 loss of antiplatelet efficacy"
    },

    # -------------------------------------------------------------------------
    # CATEGORY B: Brand Alias True Positives
    # -------------------------------------------------------------------------
    {
        "id": "DDI-BRAND-001",
        "category": "BRAND_ALIAS_RESOLUTION",
        "candidate": "Advil 200mg",
        "active": ["Coumadin 5mg"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-002",
        "expected_severity": "major",
        "clinical_note": "Coumadin (warfarin) + Advil (ibuprofen) brand alias match"
    },
    {
        "id": "DDI-BRAND-002",
        "category": "BRAND_ALIAS_RESOLUTION",
        "candidate": "Glucophage 500mg",
        "active": ["Alcohol"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-005",
        "expected_severity": "major",
        "clinical_note": "Glucophage (metformin) + Alcohol brand alias match"
    },
    {
        "id": "DDI-BRAND-003",
        "category": "BRAND_ALIAS_RESOLUTION",
        "candidate": "Biaxin 500mg",
        "active": ["Lipitor 20mg"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-007",
        "expected_severity": "major",
        "clinical_note": "Lipitor (atorvastatin) + Biaxin (clarithromycin) brand alias match"
    },
    {
        "id": "DDI-BRAND-004",
        "category": "BRAND_ALIAS_RESOLUTION",
        "candidate": "Prilosec 20mg",
        "active": ["Plavix 75mg"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-008",
        "expected_severity": "major",
        "clinical_note": "Prilosec (omeprazole) + Plavix (clopidogrel) brand alias match"
    },

    # -------------------------------------------------------------------------
    # CATEGORY C: Multi-Ingredient Combination Products
    # -------------------------------------------------------------------------
    {
        "id": "DDI-COMB-001",
        "category": "COMBINATION_DECOMPOSITION",
        "candidate": "Combiflam",
        "active": ["Warfarin"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-002",
        "expected_severity": "major",
        "clinical_note": "Combiflam contains ibuprofen which triggers RUL-INT-002 with Warfarin"
    },
    {
        "id": "DDI-COMB-002",
        "category": "COMBINATION_DECOMPOSITION",
        "candidate": "Augmentin 625mg",
        "active": ["Methotrexate"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-004",
        "expected_severity": "major",
        "clinical_note": "Augmentin contains amoxicillin which triggers RUL-INT-004 with Methotrexate"
    },
    {
        "id": "DDI-COMB-003",
        "category": "COMBINATION_DECOMPOSITION",
        "candidate": "Janumet",
        "active": ["Alcohol"],
        "allergies": [],
        "expected_detected": True,
        "expected_rule": "RUL-INT-005",
        "expected_severity": "major",
        "clinical_note": "Janumet contains metformin which triggers RUL-INT-005 with Alcohol"
    },

    # -------------------------------------------------------------------------
    # CATEGORY D: Duplicate Active Ingredient Detections
    # -------------------------------------------------------------------------
    {
        "id": "DDI-DUP-001",
        "category": "DUPLICATE_INGREDIENT",
        "candidate": "Combiflam",
        "active": ["Crocin 500mg"],
        "allergies": [],
        "expected_duplicate": True,
        "expected_duplicate_moiety": "paracetamol",
        "clinical_note": "Combiflam + Crocin both deliver paracetamol (risk of accidental overdose)"
    },
    {
        "id": "DDI-DUP-002",
        "category": "DUPLICATE_INGREDIENT",
        "candidate": "Tylenol 500mg",
        "active": ["Dolo 650"],
        "allergies": [],
        "expected_duplicate": True,
        "expected_duplicate_moiety": "paracetamol",
        "clinical_note": "Tylenol + Dolo 650 both deliver paracetamol"
    },

    # -------------------------------------------------------------------------
    # CATEGORY E: Negative Controls (Inferred Non-Interacting Pairs)
    # Note: Evaluated as non-interacting based on zero matched DDI rules among
    # indexed entities. Compatibility is inferred from the absence of an interaction
    # rule, aligned with standard clinical practice guidelines (ADA, AHA/ACC).
    # -------------------------------------------------------------------------
    {
        "id": "DDI-NEG-001",
        "category": "NEGATIVE_CONTROL_INFERRED_NON_INTERACTING",
        "candidate": "Amlodipine 5mg",
        "active": ["Metformin 500mg"],
        "allergies": [],
        "expected_detected": False,
        "clinical_note": "Metformin + Amlodipine: Inferred non-interacting (routine co-prescription in ADA guidelines; zero matching local DDI rules)"
    },
    {
        "id": "DDI-NEG-002",
        "category": "NEGATIVE_CONTROL_INFERRED_NON_INTERACTING",
        "candidate": "Amlodipine 5mg",
        "active": ["Lisinopril 10mg"],
        "allergies": [],
        "expected_detected": False,
        "clinical_note": "Lisinopril + Amlodipine: Inferred non-interacting (guideline-recommended dual therapy in AHA/ACC; zero matching local DDI rules)"
    },
    {
        "id": "DDI-NEG-003",
        "category": "NEGATIVE_CONTROL_INFERRED_NON_INTERACTING",
        "candidate": "Paracetamol 500mg",
        "active": ["Amoxicillin 500mg"],
        "allergies": [],
        "expected_detected": False,
        "clinical_note": "Paracetamol + Amoxicillin: Inferred non-interacting (common analgesic + antibiotic combination; zero matching local DDI rules)"
    },
    {
        "id": "DDI-NEG-004",
        "category": "NEGATIVE_CONTROL_INFERRED_NON_INTERACTING",
        "candidate": "Paracetamol 650mg",
        "active": ["Omeprazole 20mg"],
        "allergies": [],
        "expected_detected": False,
        "clinical_note": "Omeprazole + Paracetamol: Inferred non-interacting (compatible PPI + non-NSAID analgesic; zero matching local DDI rules)"
    },
    {
        "id": "DDI-NEG-005",
        "category": "NEGATIVE_CONTROL_INFERRED_NON_INTERACTING",
        "candidate": "Atorvastatin 20mg",
        "active": ["Metformin 1000mg"],
        "allergies": [],
        "expected_detected": False,
        "clinical_note": "Atorvastatin + Metformin: Inferred non-interacting (routine statin + antidiabetic in ADA/ACC guidelines; zero matching local DDI rules)"
    },

    # -------------------------------------------------------------------------
    # CATEGORY F: Unknown / Out-of-Domain Pairs (Abstention & Partial Coverage)
    # -------------------------------------------------------------------------
    {
        "id": "DDI-UNK-001",
        "category": "UNKNOWN_ABSTENTION_INVARIANT",
        "candidate": "DrugABC",
        "active": ["DrugXYZ"],
        "allergies": [],
        "expected_detected": False,
        "expected_abstention": True,
        "clinical_note": "Completely synthetic unknown pair: must trigger no_matching_local_rule, never 'safe'"
    },
    {
        "id": "DDI-UNK-002",
        "category": "UNKNOWN_ABSTENTION_INVARIANT",
        "candidate": "Gabapentin 300mg",
        "active": ["Sertraline 50mg"],
        "allergies": [],
        "expected_detected": False,
        "expected_abstention": True,
        "clinical_note": "Unindexed clinical pair in 8-rule corpus: must trigger partial coverage notice"
    },
    {
        "id": "DDI-UNK-003",
        "category": "UNKNOWN_ABSTENTION_INVARIANT",
        "candidate": "Montelukast 10mg",
        "active": ["Cetirizine 10mg"],
        "allergies": [],
        "expected_detected": False,
        "expected_abstention": True,
        "clinical_note": "Unindexed clinical pair: must trigger partial coverage notice"
    },
    {
        "id": "DDI-UNK-004",
        "category": "UNKNOWN_ABSTENTION_INVARIANT",
        "candidate": "Spironolactone 25mg",
        "active": ["Furosemide 40mg"],
        "allergies": [],
        "expected_detected": False,
        "expected_abstention": True,
        "clinical_note": "Unindexed clinical pair: must trigger partial coverage notice"
    },

    # -------------------------------------------------------------------------
    # CATEGORY G: Patient Allergy Conflicts
    # -------------------------------------------------------------------------
    {
        "id": "DDI-ALLERGY-001",
        "category": "ALLERGY_CONFLICT",
        "candidate": "Amoxicillin 500mg",
        "active": [],
        "allergies": ["penicillin"],
        "expected_allergy_blocked": True,
        "clinical_note": "Documented penicillin allergy contraindicates amoxicillin via beta-lactam class cross-reactivity"
    },
    {
        "id": "DDI-ALLERGY-002",
        "category": "ALLERGY_CONFLICT",
        "candidate": "Ibuprofen 400mg",
        "active": [],
        "allergies": ["aspirin"],
        "expected_allergy_blocked": True,
        "clinical_note": "Documented aspirin allergy contraindicates ibuprofen via NSAID cross-sensitivity"
    },
    {
        "id": "DDI-ALLERGY-003",
        "category": "ALLERGY_CONFLICT",
        "candidate": "Bactrim DS",
        "active": [],
        "allergies": ["sulfa"],
        "expected_allergy_blocked": True,
        "clinical_note": "Documented sulfa allergy contraindicates Bactrim (sulfamethoxazole)"
    }
]


def run_ddi_evaluation_benchmark():
    print("=" * 80)
    print("         COMPREHENSIVE CLINICAL DDI EVALUATION & BENCHMARK SUITE          ")
    print("=" * 80)
    print(f"Total benchmark test scenarios: {len(BENCHMARK_DATASET)}\n")

    # Detect if FastAPI CDS is running on port 8000
    use_http = False
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=2) as resp:
            if resp.status == 200:
                use_http = True
                print("[INFO] Connected to live CDS Gateway at http://127.0.0.1:8000 (sub-millisecond evaluations)")
    except Exception:
        pass

    orchestrator = None
    if not use_http:
        print("[INFO] FastAPI service not detected on port 8000; falling back to direct Python orchestrator (warm-up required)...")
        from cds_module.orchestrator import get_cds_orchestrator
        from cds_module.models import PrescriptionScreenRequest
        orchestrator = get_cds_orchestrator()

    tp_count = 0
    fn_count = 0
    tn_count = 0
    fp_count = 0
    abstention_pass_count = 0
    abstention_fail_count = 0
    allergy_pass_count = 0
    allergy_fail_count = 0
    duplicate_pass_count = 0
    duplicate_fail_count = 0

    results_table = []

    for test in BENCHMARK_DATASET:
        t_id = test["id"]
        cat = test["category"]
        cand = test["candidate"]
        active = test["active"]
        allergies = test["allergies"]

        payload = {
            "candidate_medications": [cand],
            "active_medications": active,
            "allergies": allergies
        }

        if use_http:
            req_data = json.dumps(payload).encode("utf-8")
            http_req = urllib.request.Request(
                "http://127.0.0.1:8000/cds/screen-prescription",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(http_req, timeout=5) as resp:
                eval_res = json.loads(resp.read().decode("utf-8"))
        else:
            req = PrescriptionScreenRequest(**payload)
            res_obj = orchestrator.screen_prescription(req)
            eval_res = res_obj.model_dump()

        screen_status = eval_res.get("screen_status")
        interactions = eval_res.get("interactions", [])
        contraindications = eval_res.get("contraindications", [])
        duplicate_ings = eval_res.get("duplicate_ingredients", [])
        rule_coverage = eval_res.get("rule_coverage", "COMPLETE")

        passed = False
        notes = ""

        if cat in ["KNOWN_INTERACTION_CANONICAL", "BRAND_ALIAS_RESOLUTION", "COMBINATION_DECOMPOSITION"]:
            rule_ids = [i.get("rule_id") for i in interactions]
            if test["expected_detected"] and test["expected_rule"] in rule_ids:
                tp_count += 1
                passed = True
                notes = f"Detected {test['expected_rule']} ({interactions[0].get('severity')})"
            else:
                fn_count += 1
                passed = False
                notes = f"MISSED EXPECTED RULE {test['expected_rule']}. Got: {rule_ids}"

        elif cat in ["NEGATIVE_CONTROL_COMPATIBLE", "NEGATIVE_CONTROL_INFERRED_NON_INTERACTING"]:
            if len(interactions) == 0:
                tn_count += 1
                passed = True
                notes = "Inferred non-interacting: Zero DDI rules matched among indexed entities (Guideline co-prescription)"
            else:
                fp_count += 1
                passed = False
                notes = f"FALSE POSITIVE: Detected unexpected interaction: {[i.get('rule_id') for i in interactions]}"

        elif cat == "DUPLICATE_INGREDIENT":
            found_dup = False
            for dup in duplicate_ings:
                if test["expected_duplicate_moiety"].lower() in str(dup).lower():
                    found_dup = True
                    break
            if found_dup:
                duplicate_pass_count += 1
                passed = True
                notes = f"Correctly flagged duplicate constituent '{test['expected_duplicate_moiety']}'"
            else:
                duplicate_fail_count += 1
                passed = False
                notes = f"Failed to detect duplicate active ingredient. Got: {duplicate_ings}"

        elif cat == "UNKNOWN_ABSTENTION_INVARIANT":
            # Safety Invariant: Must return no_matching_local_rule or partial coverage, NEVER safe!
            is_abstention = screen_status in ["no_matching_local_rule", "partial_coverage"] or rule_coverage in ["PARTIAL", "NO_MATCHING_LOCAL_RULE"]
            is_falsely_safe = (screen_status == "safe" or rule_coverage == "COMPLETE") and len(interactions) == 0
            if is_abstention and not is_falsely_safe:
                abstention_pass_count += 1
                passed = True
                notes = f"Abstained safely: status='{screen_status}', coverage='{rule_coverage}' (Zero false safety claim)"
            else:
                abstention_fail_count += 1
                passed = False
                notes = f"SAFETY INVARIANT VIOLATED: Unindexed pair labeled safe! status='{screen_status}', coverage='{rule_coverage}'"

        elif cat == "ALLERGY_CONFLICT":
            if len(contraindications) > 0 and any("ALLERGY CONTRAINDICATION" in str(c) for c in contraindications):
                allergy_pass_count += 1
                passed = True
                notes = f"Allergy contraindication correctly blocked candidate: {contraindications[0][:75]}..."
            else:
                allergy_fail_count += 1
                passed = False
                notes = f"Failed to block allergic candidate with allergies {allergies}"

        status_symbol = "✓ PASS" if passed else "✗ FAIL"
        results_table.append({
            "id": t_id,
            "category": cat,
            "test": f"{cand} + {active if active else allergies}",
            "status": status_symbol,
            "notes": notes
        })
        print(f"[{status_symbol}] {t_id:<16} | {cat:<30} | {notes}")

    # Calculate metrics
    sensitivity = tp_count / (tp_count + fn_count) if (tp_count + fn_count) > 0 else 0.0
    specificity = tn_count / (tn_count + fp_count) if (tn_count + fp_count) > 0 else 0.0
    total_unknowns = abstention_pass_count + abstention_fail_count
    abstention_rate = abstention_pass_count / total_unknowns if total_unknowns > 0 else 0.0

    print("\n" + "=" * 80)
    print("                    EMPIRICAL BENCHMARK METRICS SUMMARY                   ")
    print("=" * 80)
    print(f"True Positives (Detected Known Interactions):     {tp_count} / {tp_count + fn_count} (Sensitivity: {sensitivity * 100:.2f}%)")
    print(f"False Negatives (Missed Known Interactions):       {fn_count}")
    print(f"True Negatives (Inferred Non-Interacting Controls): {tn_count} / {tn_count + fp_count} (Specificity: {specificity * 100:.2f}%)")
    print(f"False Positives (Spurious Interactions):          {fp_count}")
    print(f"Duplicate Ingredient Invariant Matches:           {duplicate_pass_count} / {duplicate_pass_count + duplicate_fail_count}")
    print(f"Allergy Contraindication Blocks:                  {allergy_pass_count} / {allergy_pass_count + allergy_fail_count}")
    print(f"Unknown Pair Abstention Compliance:               {abstention_pass_count} / {total_unknowns} (Abstention Rate: {abstention_rate * 100:.2f}%)")
    print(f"Safety Violation Rate (False 'Safe' on Unknowns):  {abstention_fail_count} / {total_unknowns} (0.00% target)")
    print("=" * 80)

    total_failures = fn_count + fp_count + abstention_fail_count + allergy_fail_count + duplicate_fail_count
    if total_failures == 0:
        print("\n>>> RESULT: 100% OF BENCHMARK SCENARIOS PASSED WITH STRICT SAFETY INVARIANTS! <<<\n")
        return 0
    else:
        print(f"\n>>> RESULT: FAILED with {total_failures} failures. <<<\n")
        return 1


if __name__ == "__main__":
    sys.exit(run_ddi_evaluation_benchmark())
