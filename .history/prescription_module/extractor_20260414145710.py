"""
Build a prescription analysis engine combining NLP and regex.

Requirements:
- Use spaCy pipeline from nlp_pipeline
- Use regex extraction functions

Tasks:
- Process input text with spaCy
- Extract DRUG entities

For each DRUG:
- Extract a local context window (±5 words around entity)
- Apply regex only within this window
- Assign correct dosage and frequency to each drug

Output format:
{
  "drugs": [
    {
      "name": "Paracetamol",
      "dosage": "500mg",
      "frequency": "twice daily",
      "confidence": 0.9
    }
  ]
}

Constraints:
- Handle multiple drugs in one sentence
- Avoid assigning same dosage to all drugs
- Keep logic rule-based

Goal:
- Achieve realistic prescription parsing behavior
"""

from nlp_pipeline import load_nlp
from regex_rules import extract_dosage, extract_frequency

nlp = load_nlp()


def get_context_window(doc, ent, window_size=5):
    start = max(ent.start - window_size, 0)
    end = min(ent.end + window_size, len(doc))
    return doc[start:end].text


def analyze_prescription(text):
    doc = nlp(text)

    drugs = []

    for ent in doc.ents:
        if ent.label_ == "DRUG":
            context = get_context_window(doc, ent)

            dosage = extract_dosage(context)
            frequency = extract_frequency(context)

            drug_info = {
                "name": ent.text,
                "dosage": dosage,
                "frequency": frequency,
                "confidence": 0.9 if dosage or frequency else 0.6
            }

            drugs.append(drug_info)

    return {"drugs": drugs}