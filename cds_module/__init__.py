"""
CDS Module: Clinical Decision Support Gateway Coordination Layer.
Orchestrates frozen RAG intelligence, deterministic drug safety, and request-scoped clinical context.
"""

from cds_module.models import (
    CDSEvaluateRequest,
    CDSEvaluateResponse,
    CDSCitation,
    DrugInteractionAlert,
    PatientContext,
    PrescriptionScreenRequest,
    PrescriptionScreenResponse
)

__all__ = [
    "CDSEvaluateRequest",
    "CDSEvaluateResponse",
    "CDSCitation",
    "DrugInteractionAlert",
    "PatientContext",
    "PrescriptionScreenRequest",
    "PrescriptionScreenResponse"
]
