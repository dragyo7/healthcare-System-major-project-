"""
Create a FastAPI service for prescription analysis.

Requirements:
- Initialize FastAPI app
- Create POST endpoint /analyze-prescription
- Accept JSON input:
    { "text": "prescription string" }

Tasks:
- Use Pydantic model for request validation
- Call analyze_prescription() from extractor
- Return structured JSON response

Constraints:
- Keep API minimal and fast
- No external API calls during request handling

Goal:
- Provide a production-ready API for NLP extraction
"""