"""
Build a prescription analysis function combining spaCy and regex.

Requirements:
- Use load_nlp() from nlp_pipeline
- Use regex functions from regex_rules
- Process input text with spaCy
- Extract DRUG entities from doc.ents

For each detected drug:
- Assign:
    name -> entity text
    dosage -> extracted using regex
    frequency -> extracted using regex

Output format:
{
  "drugs": [
    {
      "name": "Paracetamol",
      "dosage": "500mg",
      "frequency": "twice daily"
    }
  ]
}

Constraints:
- Return structured JSON (dict)
- Handle multiple drugs in text
- Keep logic simple (no ML training)
"""