"""
Create a spaCy NLP pipeline for extracting drug names from prescription text.

Requirements:
- Load spaCy model "en_core_web_sm"
- Add an EntityRuler before the default NER
- Define patterns for DRUG entities (e.g., Paracetamol, Ibuprofen, Amoxicillin, Metformin, Aspirin)
- The pipeline should return an initialized nlp object

Constraints:
- No training required
- Use rule-based approach
- Keep it lightweight and fast

Output:
- Function load_nlp() that returns the configured nlp pipeline
"""