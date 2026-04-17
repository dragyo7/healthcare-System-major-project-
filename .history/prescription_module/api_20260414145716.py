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

from fastapi import FastAPI
from pydantic import BaseModel
from extractor import analyze_prescription

app = FastAPI()


class PrescriptionRequest(BaseModel):
    text: str


@app.post("/analyze-prescription")
def analyze(request: PrescriptionRequest):
    return analyze_prescription(request.text)