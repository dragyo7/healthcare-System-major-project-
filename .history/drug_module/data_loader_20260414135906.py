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

    interaction_dict = {}

    # Try to detect columns safely
    columns = [col.lower() for col in df.columns]

    # Expected: drug_a, drug_b, severity, description
    for _, row in df.iterrows():
        try:
            drug_a = str(row[0]).strip().lower()
            drug_b = str(row[1]).strip().lower()

            severity = str(row[2]).strip().lower() if len(row) > 2 else "unknown"
            description = str(row[3]).strip() if len(row) > 3 else "No description available"

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
            continue  # skip bad rows safely

    return interaction_dict


def load_sider(file_path="datasets/sider.csv"):
    """
    Loads SIDER dataset and returns:
    side_effects_dict[drug] = [effects]
    """

    df = pd.read_csv(file_path)
    print(df.head())
    print(df.columns)
    
    side_effects_dict = {}

    for _, row in df.iterrows():
        try:
            drug = str(row[0]).strip().lower()
            effect = str(row[1]).strip().lower()

            if drug and effect:
                if drug not in side_effects_dict:
                    side_effects_dict[drug] = []

                side_effects_dict[drug].append(effect)

        except Exception:
            continue

    return side_effects_dict


if __name__ == "__main__":
    interactions = load_drugbank()
    side_effects = load_sider()

    print("Sample interactions:", list(interactions.items())[:5])
    print("Sample side effects:", list(side_effects.items())[:5])