"""
Prescription extraction engine.

Uses:
- spaCy EntityRuler for medicine detection
- Regex rules for dosage, frequency, duration, etc.
"""

from nlp_pipeline import load_nlp

from regex_rules import (
    extract_dosage,
    extract_frequency,
    extract_duration,
    extract_route,
    extract_instruction
)

nlp = load_nlp()


def get_context_window(doc, ent, window_size=10):
    """
    Get words surrounding the detected drug.
    """

    start = max(ent.start - window_size, 0)
    end = min(ent.end + window_size, len(doc))

    return doc[start:end].text


def calculate_confidence(
    dosage,
    frequency,
    duration,
    route,
    instruction
):
    """
    Simple rule-based confidence.
    """

    confidence = 0.40

    if dosage:
        confidence += 0.20

    if frequency:
        confidence += 0.15

    if duration:
        confidence += 0.10

    if route:
        confidence += 0.10

    if instruction:
        confidence += 0.05

    return round(min(confidence, 1.0), 2)


def analyze_prescription(text):

    drugs = []

    # Process each non-empty line separately
    for line in text.splitlines():

        line = line.strip()

        if not line:
            continue

        doc = nlp(line)

        for ent in doc.ents:

            if ent.label_ != "DRUG":
                continue

            dosage = extract_dosage(line)
            frequency = extract_frequency(line)
            duration = extract_duration(line)
            route = extract_route(line)
            instruction = extract_instruction(line)

            confidence = calculate_confidence(
                dosage,
                frequency,
                duration,
                route,
                instruction
            )

            drugs.append({
                "name": ent.text.title(),
                "dosage": dosage,
                "frequency": frequency,
                "duration": duration,
                "route": route,
                "instructions": instruction,
                "confidence": confidence
            })

    return {
        "drug_count": len(drugs),
        "drugs": drugs
    }