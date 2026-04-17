"""
FastAPI application for drug safety system.

Endpoints:

1. POST /check-interaction
Request:
{
    "drugs": ["drugA", "drugB"]
}

Response:
{
    "interactions": [...]
}

2. POST /check-side-effects
Request:
{
    "drug": "aspirin"
}

Response:
{
    "side_effects": [...],
    "source": "SIDER + openFDA"
}

Requirements:
- Use FastAPI
- Load datasets at startup
- Use dependency injection or global load
- Validate input using Pydantic
- Return proper JSON responses

Run using:
uvicorn api:app --reload
"""