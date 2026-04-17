"""
Create a FastAPI service for prescription analysis.

Requirements:
- Initialize FastAPI app
- Define a POST endpoint: /analyze-prescription
- Accept JSON input:
    {
      "text": "prescription string"
    }

- Use Pydantic model for request validation
- Call analyze_prescription() from extractor
- Return JSON response

Constraints:
- Keep API minimal and clean
- No authentication required
- Must be runnable with uvicorn
"""