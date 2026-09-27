from fastapi import FastAPI
from pydantic import BaseModel, Field

from extractor import analyze_prescription

app = FastAPI(
    title="Prescription Information Extraction API",
    description="""
Extract structured information from free-text medical prescriptions.

Extracts:
- Drug Name
- Dosage
- Frequency
- Duration
- Route
- Instructions
- Confidence Score
""",
    version="1.0.0"
)


class PrescriptionRequest(BaseModel):
    text: str = Field(
        ...,
        examples=[
            """
Take Paracetamol 500mg orally twice daily after meals for 5 days.

Metformin 500mg BD after breakfast.

Ibuprofen 400mg every 8 hours before meals.
"""
        ]
    )


@app.get("/")
def root():
    return {
        "message": "Prescription Information Extraction API",
        "docs": "/docs"
    }


@app.post("/analyze-prescription")
def analyze(request: PrescriptionRequest):
    return analyze_prescription(request.text)

