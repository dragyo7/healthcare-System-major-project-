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

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

from data_loader import load_drugbank, load_sider
from interaction_engine import check_interactions
from side_effect_engine import get_side_effects

app = FastAPI(title="Drug Safety API")


# -------- Load Data Once --------
interaction_dict = load_drugbank()
side_effects_dict = load_sider()


# -------- Request Models --------
class InteractionRequest(BaseModel):
    drugs: List[str]


class SideEffectRequest(BaseModel):
    drug: str


# -------- Routes --------
@app.post("/check-interaction")
def check_interaction_api(request: InteractionRequest):
    interactions = check_interactions(request.drugs, interaction_dict)

    return {
        "interactions": interactions
    }


@app.post("/check-side-effects")
def check_side_effects_api(request: SideEffectRequest):
    try:
        result = get_side_effects(request.drug, side_effects_dict)
        return result
    except Exception as e:
        return {
            "error": str(e),
            "message": "Failed to fetch side effects"
        }