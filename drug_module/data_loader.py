"""
Load and preprocess verified clinical drug interaction and adverse effect datasets.
Prioritizes authoritative FDA SPL/DailyMed rules with fallbacks to legacy CSV files.
"""
import os
import json
from pathlib import Path
from typing import Dict, Any, Tuple, List, Optional
import pandas as pd

# Root directory resolution
ROOT_DIR = Path(__file__).resolve().parent.parent
RULES_DIR = ROOT_DIR / "data" / "rules" / "medication_interactions"
DEFAULT_INTERACTIONS_JSON = RULES_DIR / "medication_interactions.json"
DEFAULT_SIDE_EFFECTS_JSON = RULES_DIR / "medication_side_effects.json"


def load_drugbank(file_path: Optional[str] = None) -> Dict[Tuple[str, str], Dict[str, Any]]:
    """
    Loads verified clinical drug-drug interactions.
    Prioritizes verified JSON rulebase (data/rules/medication_interactions/medication_interactions.json),
    falling back to CSV if explicitly requested or JSON is absent.
    
    Returns:
        interaction_dict[(drugA, drugB)] = {
            "severity": str,
            "description": str,
            "clinical_action": str,
            "source_id": str,
            "source_url": str,
            "rule_id": str,
            "provenance_status": str
        }
    """
    interaction_dict = {}
    json_path = Path(file_path) if file_path and file_path.endswith(".json") else DEFAULT_INTERACTIONS_JSON
    csv_fallback = Path(__file__).resolve().parent / "datasets" / "drugbank.csv"

    if json_path.exists():
        print(f"[DrugModule] Loading verified interaction rules from: {json_path}")
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            rules = data.get("rules", [])
            for r in rules:
                drug_a = str(r.get("drug_a", "")).strip().lower()
                drug_b = str(r.get("drug_b", "")).strip().lower()
                if drug_a and drug_b:
                    rule_info = {
                        "severity": str(r.get("severity", "moderate")).lower(),
                        "description": r.get("finding", ""),
                        "clinical_action": r.get("clinical_action", ""),
                        "source_id": r.get("source_id", "DailyMed"),
                        "source_url": r.get("source_url", ""),
                        "rule_id": r.get("rule_id", ""),
                        "provenance_status": r.get("provenance_status", "VERIFIED")
                    }
                    interaction_dict[(drug_a, drug_b)] = rule_info
                    interaction_dict[(drug_b, drug_a)] = rule_info
            print(f"[DrugModule] Loaded {len(rules)} verified bidirectional interaction rules.")
            return interaction_dict
        except Exception as e:
            print(f"[DrugModule] Warning: Failed to load JSON rules ({e}), attempting CSV fallback...")

    # Fallback to CSV if JSON not available
    csv_path = Path(file_path) if file_path else csv_fallback
    if csv_path.exists():
        print(f"[DrugModule] Loading legacy interaction CSV from: {csv_path}")
        df = pd.read_csv(csv_path)
        required_cols = ["drugA", "drugB", "severity", "description"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Missing column in interaction CSV: {col}")

        for _, row in df.iterrows():
            drug_a = str(row["drugA"]).strip().lower()
            drug_b = str(row["drugB"]).strip().lower()
            severity = str(row["severity"]).strip().lower()
            description = str(row["description"]).strip()

            if drug_a and drug_b:
                rule_info = {
                    "severity": severity,
                    "description": description,
                    "clinical_action": "Consult clinical pharmacist or prescriber.",
                    "source_id": "Legacy_Dataset",
                    "source_url": "",
                    "rule_id": f"LEG-{len(interaction_dict)//2 + 1}",
                    "provenance_status": "HISTORICAL"
                }
                interaction_dict[(drug_a, drug_b)] = rule_info
                interaction_dict[(drug_b, drug_a)] = rule_info
    return interaction_dict


def load_sider(file_path: Optional[str] = None) -> Dict[str, List[str]]:
    """
    Loads verified adverse reactions and side effects.
    Prioritizes verified JSON rulebase (data/rules/medication_interactions/medication_side_effects.json),
    falling back to CSV if absent.
    
    Returns:
        side_effects_dict[drug] = list of side effect strings
    """
    side_effects_dict = {}
    json_path = Path(file_path) if file_path and file_path.endswith(".json") else DEFAULT_SIDE_EFFECTS_JSON
    csv_fallback = Path(__file__).resolve().parent / "datasets" / "sider.csv"

    if json_path.exists():
        print(f"[DrugModule] Loading verified side effects from: {json_path}")
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            effects_map = data.get("side_effects", {})
            for drug, effects in effects_map.items():
                drug_norm = drug.strip().lower()
                side_effects_dict[drug_norm] = [str(e).strip().lower() for e in effects]
            print(f"[DrugModule] Loaded verified adverse effects for {len(side_effects_dict)} medications.")
            return side_effects_dict
        except Exception as e:
            print(f"[DrugModule] Warning: Failed to load JSON side effects ({e}), attempting CSV fallback...")

    # Fallback to CSV
    csv_path = Path(file_path) if file_path else csv_fallback
    if csv_path.exists():
        print(f"[DrugModule] Loading legacy SIDER CSV from: {csv_path}")
        df = pd.read_csv(csv_path)
        required_cols = ["drug", "side_effect"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Missing column in SIDER CSV: {col}")

        for _, row in df.iterrows():
            drug = str(row["drug"]).strip().lower()
            effect = str(row["side_effect"]).strip().lower()
            if drug and effect:
                if drug not in side_effects_dict:
                    side_effects_dict[drug] = []
                side_effects_dict[drug].append(effect)
    return side_effects_dict


if __name__ == "__main__":
    interactions = load_drugbank()
    side_effects = load_sider()
    print("\nSample interactions:", list(interactions.keys())[:5])
    for drug in list(side_effects.keys())[:5]:
        print(f"  {drug}: {side_effects[drug][:3]}...")