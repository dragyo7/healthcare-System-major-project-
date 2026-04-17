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