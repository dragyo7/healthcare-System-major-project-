"""
Load and preprocess DrugBank and SIDER datasets.

Requirements:
- Read CSV files using pandas
- Create:
    1. interaction_dict[(drugA, drugB)] = {"severity": str, "description": str}
    2. side_effects_dict[drug] = list of side effects

Notes:
- Normalize drug names to lowercase
- Strip whitespace
- Ensure drug interaction pairs are bidirectional
- Handle missing values safely
"""

# Implement:
# def load_drugbank(file_path: str) -> dict
# def load_sider(file_path: str) -> dict

import pandas as pd


def load_drugbank(file_path="datasets/drugbank.csv"):
    """
    Loads DrugBank interaction dataset and returns:
    interaction_dict[(drugA, drugB)] = {
        "severity": str,
        "description": str
    }
    """

    df = pd.read_csv(file_path)

    print("\n=== DRUGBANK DEBUG ===")
    print(df.head())
    print("Columns:", df.columns)
    print("Shape:", df.shape)

    interaction_dict = {}

    # Ensure expected columns exist
    required_cols = ["drugA", "drugB", "severity", "description"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing column: {col}")

    for _, row in df.iterrows():
        try:
            drug_a = str(row["drugA"]).strip().lower()
            drug_b = str(row["drugB"]).strip().lower()
            severity = str(row["severity"]).strip().lower()
            description = str(row["description"]).strip()

            if drug_a and drug_b:
                interaction_dict[(drug_a, drug_b)] = {
                    "severity": severity,
                    "description": description
                }

                # Bidirectional
                interaction_dict[(drug_b, drug_a)] = {
                    "severity": severity,
                    "description": description
                }

        except Exception as e:
            print("Row error:", e)
            continue

    return interaction_dict


def load_sider(file_path="datasets/sider.csv"):
    """
    Loads SIDER dataset and returns:
    side_effects_dict[drug] = [effects]
    """

    df = pd.read_csv(file_path)

    print("\n=== SIDER DEBUG ===")
    print(df.head())
    print("Columns:", df.columns)
    print("Shape:", df.shape)

    side_effects_dict = {}

    required_cols = ["drug", "side_effect"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Missing column: {col}")

    for _, row in df.iterrows():
        try:
            drug = str(row["drug"]).strip().lower()
            effect = str(row["side_effect"]).strip().lower()

            if drug and effect:
                if drug not in side_effects_dict:
                    side_effects_dict[drug] = []

                side_effects_dict[drug].append(effect)

        except Exception as e:
            print("Row error:", e)
            continue

    return side_effects_dict


if __name__ == "__main__":
    interactions = load_drugbank()
    side_effects = load_sider()

    print("\nSample interactions:", list(interactions.items())[:5])
    for drug, effects in list(side_effects.items())[:5]:
        print(f"{drug} -> {effects}")