"""
Regex-based extraction for clinical prescription text.

Extracts:
- Dosage
- Frequency
- Duration
- Route
- Instructions

Also normalizes common medical abbreviations.

Examples:
500mg
10 ml
1 tablet
BD
OD
every 8 hours
for 5 days
oral
after meals
"""

import re

# -------------------------
# DOSAGE
# -------------------------

DOSAGE_PATTERN = re.compile(
    r"\b("
    r"\d+\s?(?:mg|g|mcg|ml)"
    r"|"
    r"\d+\s?(?:tablet|tablets|capsule|capsules)"
    r")\b",
    re.IGNORECASE
)

# -------------------------
# FREQUENCY
# -------------------------

FREQUENCY_PATTERN = re.compile(
    r"\b("
    r"once daily|"
    r"twice daily|"
    r"thrice daily|"
    r"once a day|"
    r"twice a day|"
    r"three times a day|"
    r"every\s+\d+\s+hours?|"
    r"every\s+\d+\s+days?|"
    r"OD|BD|TID|QID|SOS|HS"
    r")\b",
    re.IGNORECASE
)

FREQ_MAP = {
    "OD": "once daily",
    "BD": "twice daily",
    "TID": "thrice daily",
    "QID": "four times daily",
    "HS": "at bedtime",
    "SOS": "as needed"
}

# -------------------------
# DURATION
# -------------------------

DURATION_PATTERN = re.compile(
    r"\bfor\s+\d+\s+(?:day|days|week|weeks|month|months)\b",
    re.IGNORECASE
)

# -------------------------
# ROUTE
# -------------------------

ROUTE_PATTERN = re.compile(
    r"\b("
    r"oral|"
    r"orally|"
    r"iv|"
    r"intravenous|"
    r"im|"
    r"intramuscular|"
    r"topical|"
    r"inhalation|"
    r"inhaled"
    r")\b",
    re.IGNORECASE
)

# -------------------------
# INSTRUCTIONS
# -------------------------

INSTRUCTION_PATTERN = re.compile(
    r"\b("
    r"after meals|"
    r"before meals|"
    r"after food|"
    r"before food|"
    r"after breakfast|"
    r"after lunch|"
    r"after dinner|"
    r"with food|"
    r"empty stomach|"
    r"at bedtime"
    r")\b",
    re.IGNORECASE
)


# ======================================================
# Extraction Functions
# ======================================================

def extract_dosage(text):
    match = DOSAGE_PATTERN.search(text)
    return match.group(0) if match else None


def extract_frequency(text):
    match = FREQUENCY_PATTERN.search(text)

    if not match:
        return None

    value = match.group(0)

    if value.upper() in FREQ_MAP:
        return FREQ_MAP[value.upper()]

    return value.lower()


def extract_duration(text):
    match = DURATION_PATTERN.search(text)
    return match.group(0) if match else None


def extract_route(text):
    match = ROUTE_PATTERN.search(text)
    return match.group(0).lower() if match else None


def extract_instruction(text):
    match = INSTRUCTION_PATTERN.search(text)
    return match.group(0).lower() if match else None

#For testing purposes
if __name__ == "__main__":
    sample = """
    Take Paracetamol 500mg orally twice daily after meals for 5 days.
    """

    print("Dosage:", extract_dosage(sample))
    print("Frequency:", extract_frequency(sample))
    print("Duration:", extract_duration(sample))
    print("Route:", extract_route(sample))
    print("Instruction:", extract_instruction(sample))