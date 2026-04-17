"""
Implement regex-based extraction for prescription text.

Requirements:
- Extract dosage values like:
  - 500mg, 10 ml, 250 g, 5mcg
- Extract frequency expressions like:
  - once daily, twice daily, thrice daily
  - OD, BD, TID
  - every 6 hours, at night, before meals

Tasks:
- Define regex patterns for dosage and frequency
- Implement:
    extract_dosage(text: str) -> str | None
    extract_frequency(text: str) -> str | None

Constraints:
- Case insensitive matching
- Return first match only
- Keep patterns simple but extendable
"""