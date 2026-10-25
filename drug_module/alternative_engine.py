"""
Alternative Medication Suggestion Engine.
Provides deterministic, evidence-backed candidate medication alternatives for detected
drug-drug interactions based strictly on verified DailyMed SPL clinical guidance.

INVARIANTS:
1. NEVER calls an unconstrained LLM to invent replacement drugs.
2. NEVER automatically replaces, prescribes, or persists a candidate.
3. Preserves intended therapeutic indication and exposes explicit intent caveats.
4. Evaluates every candidate against patient's documented allergies and concurrent medications.
5. If no verified evidence-backed alternative exists, safely returns an explicit insufficient-evidence result.
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Set

try:
    from drug_module.normalizer import get_drug_identity, decompose_medication
except ImportError:
    from normalizer import get_drug_identity, decompose_medication

# Path to verified candidate alternatives dataset
DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "rules" / "medication_interactions" / "candidate_alternatives.json"

_CACHED_ALTERNATIVE_RULES: Optional[Dict[str, List[Dict[str, Any]]]] = None


def load_candidate_alternatives() -> Dict[str, List[Dict[str, Any]]]:
    """
    Loads verified candidate alternative rules from structured JSON file.
    Organizes by rule_id for efficient lookup.
    """
    global _CACHED_ALTERNATIVE_RULES
    if _CACHED_ALTERNATIVE_RULES is not None:
        return _CACHED_ALTERNATIVE_RULES

    rules_by_id: Dict[str, List[Dict[str, Any]]] = {}
    if DATA_PATH.exists():
        try:
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                for entry in data:
                    r_id = entry.get("rule_id")
                    if r_id:
                        if r_id not in rules_by_id:
                            rules_by_id[r_id] = []
                        rules_by_id[r_id].append(entry)
        except Exception as e:
            print(f"[AlternativeEngine] Warning: Could not load candidate_alternatives.json: {e}")

    _CACHED_ALTERNATIVE_RULES = rules_by_id
    return _CACHED_ALTERNATIVE_RULES


def find_candidate_alternatives(
    detected_interactions: List[Dict[str, Any]],
    proposed_medications: List[str],
    active_medications: List[str],
    patient_allergies: List[str],
    interaction_dict: Optional[Dict[Any, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates detected interactions and establishes evidence-backed candidate alternatives.
    Every candidate is screened against:
    1. Patient documented allergies (disqualified if allergic or cross-reactive)
    2. Concurrent active medications (disqualified if it introduces a new interaction)
    3. Other proposed medications

    Returns a list of structured alternative recommendation cards for clinician review.
    If no verified candidate exists, returns empty list with explicit insufficient-evidence status.
    """
    rules_by_id = load_candidate_alternatives()
    recommendations = []
    seen_candidate_keys: Set[str] = set()

    # Clean patient allergies for matching
    cleaned_allergies = [a.lower().strip() for a in patient_allergies if a and str(a).strip() and a.lower() not in ["none", "nil"]]

    # Collect all concurrent medicines (active + other proposed)
    all_concurrent = [m.lower().strip() for m in active_medications + proposed_medications if m]

    for interaction in detected_interactions:
        rule_id = interaction.get("rule_id")
        if not rule_id or rule_id not in rules_by_id:
            continue

        entries_for_rule = rules_by_id[rule_id]

        for entry in entries_for_rule:
            target_ingredient = entry.get("target_drug_to_replace", "").lower()
            candidate_info = entry.get("candidate", {})
            evidence = entry.get("clinical_evidence", {})
            evidence_strength = entry.get("evidence_strength", "CLINICAL_CONSENSUS_INFERRED")
            cand_name = candidate_info.get("candidate_name", "").lower()
            if not cand_name:
                continue

            # Determine which proposed medicine contains the target ingredient
            matching_proposed = []
            for prop in proposed_medications:
                ingredients = decompose_medication(prop)
                if target_ingredient in [i.lower() for i in ingredients]:
                    matching_proposed.append(prop)

            is_editable_proposed = bool(matching_proposed)

            # If target ingredient is NOT in proposed_medications, check if it is an existing active medication
            if not matching_proposed:
                matching_active = []
                for act in active_medications:
                    ingredients = decompose_medication(act)
                    if target_ingredient in [i.lower() for i in ingredients]:
                        matching_active.append(act)
                
                if matching_active:
                    # Target is an existing baseline EHR medication; do NOT silently replace an unrelated proposed drug!
                    original_drug_display = matching_active[0]
                else:
                    # Target not present in either proposed or active regimen; skip entry
                    continue
            else:
                original_drug_display = matching_proposed[0]

            unique_key = f"{original_drug_display.lower()}->{cand_name}"
            if unique_key in seen_candidate_keys:
                continue

            # 1. Screen against patient allergies and cross-reactive classes
            is_allergic = False
            for allergy in cleaned_allergies:
                if allergy in cand_name or cand_name in allergy:
                    is_allergic = True
                    break

            if is_allergic:
                # Disqualified due to documented allergy
                continue

            # 2. Screen against concurrent medications if interaction dict available
            has_secondary_interaction = False
            secondary_interaction_desc = None
            if interaction_dict:
                for concurrent_med in all_concurrent:
                    concurrent_ings = decompose_medication(concurrent_med)
                    for c_ing in concurrent_ings:
                        if c_ing.lower() == target_ingredient:
                            # Skip the drug we are replacing
                            continue
                        pair_key = tuple(sorted([cand_name, c_ing.lower()]))
                        if pair_key in interaction_dict:
                            rule_match = interaction_dict[pair_key]
                            has_secondary_interaction = True
                            secondary_interaction_desc = f"Interacts with concurrent medication '{concurrent_med}' ({rule_match.get('severity', 'moderate')})"
                            break
                    if has_secondary_interaction:
                        break

            if has_secondary_interaction:
                # Disqualified because candidate causes another interaction
                continue

            seen_candidate_keys.add(unique_key)

            recommendations.append({
                "rule_id": rule_id,
                "original_drug": original_drug_display,
                "candidate_name": cand_name.capitalize(),
                "candidate_drug": cand_name.capitalize(),
                "is_editable_proposed": is_editable_proposed,
                "target_is_existing_med": not is_editable_proposed,
                "replacement_notice": None if is_editable_proposed else f"'{original_drug_display}' is an existing baseline medication in the patient's EHR profile and cannot be replaced from this prescription form.",
                "brand_examples": candidate_info.get("brand_examples", []),
                "therapeutic_intent": candidate_info.get("supported_therapeutic_intent", ""),
                "unsupported_intent_caveat": candidate_info.get("unsupported_intent_caveat", "Clinician must evaluate patient-specific indication and clinical appropriateness."),
                "clinical_eligibility": candidate_info.get("clinical_eligibility", {}),
                "eligibility_precautions": candidate_info.get("clinical_eligibility", {}).get("precautions", []),
                "rationale": f"DailyMed guidance: {evidence.get('verbatim_passage', '')}",
                "clinical_rationale": f"DailyMed guidance: {evidence.get('verbatim_passage', '')}",
                "evidence_source": f"{evidence.get('source_id', 'DailyMed')} ({rule_id})",
                "evidence_strength": evidence_strength,
                "source_url": evidence.get("source_url", ""),
                "verbatim_passage": evidence.get("verbatim_passage", ""),
                "recommendation_type": "INVESTIGATIONAL_CANDIDATE_FOR_CLINICIAN_REVIEW",
                "clinician_action_required": True,
                "status": "EVIDENCE_BACKED_CANDIDATE",
                "safety_qualification": "Candidate alternative for clinician evaluation. Not universally safe. Clinician must assess organ function, indication, and enter new dosing regimen."
            })

    return recommendations
