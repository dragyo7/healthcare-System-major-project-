"""
Source Adapters Package.
Contains adapters for MedQuAD, DailyMed, openFDA, and Clinical Guidelines.
"""
from rag_module.ingestion.adapters.medquad_adapter import MedQuADAdapter
from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter
from rag_module.ingestion.adapters.openfda_adapter import OpenFDAAdapter
from rag_module.ingestion.adapters.guideline_adapter import GuidelineAdapter

__all__ = [
    "MedQuADAdapter",
    "DailyMedAdapter",
    "OpenFDAAdapter",
    "GuidelineAdapter"
]
