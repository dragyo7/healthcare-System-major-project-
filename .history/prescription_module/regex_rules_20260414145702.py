"""
Implement regex-based extraction for clinical prescription text.

Requirements:
- Extract dosage values:
  - Examples: 500mg, 10 ml, 250 g, 5mcg
- Extract frequency expressions:
  - once daily, twice daily, thrice daily
  - OD, BD, TID
  - every X hours, at night, before meals

Tasks:
- Define regex patterns for dosage and frequency
- Implement:
    extract_dosage(text)
    extract_frequency(text)

Enhancement:
- Add normalization:
    OD -> once daily
    BD -> twice daily
    TID -> thrice daily

Constraints:
- Case insensitive matching
- Return first valid match
- Keep extendable for future rules

Goal:
- Combine structured regex extraction with NLP pipeline
""""""
Implement regex-based extraction for clinical prescription text.

Requirements:
- Extract dosage values:
  - Examples: 500mg, 10 ml, 250 g, 5mcg
- Extract frequency expressions:
  - once daily, twice daily, thrice daily
  - OD, BD, TID
  - every X hours, at night, before meals

Tasks:
- Define regex patterns for dosage and frequency
- Implement:
    extract_dosage(text)
    extract_frequency(text)

Enhancement:
- Add normalization:
    OD -> once daily
    BD -> twice daily
    TID -> thrice daily

Constraints:
- Case insensitive matching
- Return first valid match
- Keep extendable for future rules

Goal:
- Combine structured regex extraction with NLP pipeline
"""

import re

DOSAGE_PATTERN = r"\b\d+\s?(mg|ml|g|mcg)\b"

FREQUENCY_PATTERN = r"\b(once daily|twice daily|thrice daily|OD|BD|TID|every \d+ hours|at night|before meals)\b"


FREQ_MAP = {
    "OD": "once daily",
    "BD": "twice daily",
    "TID": "thrice daily"
}


def normalize_frequency(freq):
    return FREQ_MAP.get(freq.upper(), freq.lower())


def extract_dosage(text):
    match = re.search(DOSAGE_PATTERN, text, re.IGNORECASE)
    return match.group() if match else None


def extract_frequency(text):
    match = re.search(FREQUENCY_PATTERN, text, re.IGNORECASE)
    if match:
        return normalize_frequency(match.group())
    return None