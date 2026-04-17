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