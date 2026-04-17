"""
Drug normalization module.

Goal:
- Normalize drug names for consistent matching.

Requirements:
- Convert to lowercase
- Strip whitespace
- Remove special characters
- Implement basic mapping (e.g., paracetamol -> acetaminophen)

Functions:
- normalize_drug_name(name: str) -> str
- normalize_list(drugs: list[str]) -> list[str]

Optional:
- Maintain a small synonym dictionary
"""

import re

# Basic synonym mapping (expand later)
DRUG_SYNONYMS = {
    "acetaminophen": "paracetamol",
    "tylenol": "paracetamol",
    "advil": "ibuprofen",
    "brufen": "ibuprofen"
}


def normalize_drug_name(name: str) -> str:
    """
    Normalize a single drug name
    """

    if not name:
        return ""

    # Lowercase
    name = name.lower()

    # Remove extra spaces
    name = name.strip()

    # Remove special characters
    name = re.sub(r"[^a-z0-9\s]", "", name)

    # Apply synonym mapping
    if name in DRUG_SYNONYMS:
        name = DRUG_SYNONYMS[name]

    return name


def normalize_list(drugs: list) -> list:
    """
    Normalize a list of drug names
    """
    return [normalize_drug_name(d) for d in drugs]


# Test block
if __name__ == "__main__":
    test = ["Paracetamol ", "TYLENOL", "Ibuprofen!", "Brufen"]
    print("Normalized:", normalize_list(test))