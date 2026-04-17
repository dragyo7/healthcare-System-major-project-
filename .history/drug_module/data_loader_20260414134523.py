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