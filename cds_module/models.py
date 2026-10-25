"""
Pydantic Request & Response Models for the CDS Gateway Coordination Layer.
Enforces request-scoped clinical context minimization, deterministic safety alert schemas,
and authoritative RAG grounding status preservation.
"""
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, model_validator


class DischargeRecord(BaseModel):
    """
    Explicit typed clinical discharge record with existence, episode provenance, and care directives.
    """
    has_discharge: bool = Field(default=False, description="True if a genuine discharge summary exists for this episode.")
    discharge_id: Optional[int] = Field(default=None, description="Episode discharge ID.")
    discharge_date: Optional[str] = Field(default=None, description="Calendar date of clinical discharge.")
    discharge_diagnosis: Optional[str] = Field(default=None, description="Primary clinician-authored discharge diagnosis.")
    discharge_instructions: Optional[str] = Field(default=None, description="Clinician-authored care directives and medication instructions.")
    discharge_summary: Optional[str] = Field(default=None, description="Clinical hospital course summary.")
    warning_signs: Optional[str] = Field(default=None, description="Personalized post-discharge recovery warning signs.")
    follow_up_instructions: Optional[str] = Field(default=None, description="Follow-up consultation directives.")
    follow_up_date: Optional[str] = Field(default=None, description="Scheduled follow-up calendar date.")
    lab_instructions: Optional[str] = Field(default=None, description="Specific laboratory testing orders or monitoring directives.")


class PatientContext(BaseModel):
    """
    Sanitized request-scoped patient clinical context.
    Strictly excludes PII (name, address, phone, email, Aadhaar, database IDs).
    """
    age: Optional[int] = Field(None, ge=0, le=130, description="Patient age in years.")
    gender: Optional[str] = Field(None, description="Patient biological sex or gender (e.g. Male, Female).")
    symptoms: List[str] = Field(default_factory=list, description="Currently reported symptoms.")
    diagnoses: List[str] = Field(default_factory=list, description="Active medical conditions and diagnoses.")
    allergies: List[str] = Field(default_factory=list, description="Documented drug and substance allergies.")
    active_medications: List[Union[str, Dict[str, Any]]] = Field(
        default_factory=list,
        description="Recorded/current medication regimen from prescription history (deduplicated by medicine). Note: The EHR schema tracks prescription dates and duration without explicit discontinuation flags."
    )
    medical_history: List[str] = Field(default_factory=list, description="Relevant past medical history.")
    lab_summaries: List[str] = Field(default_factory=list, description="Summaries of pertinent laboratory tests.")
    discharge_record: Optional[DischargeRecord] = Field(default=None, description="Authoritative clinical discharge episode record.")
    discharge_context: Optional[Dict[str, Any]] = Field(default=None, description="Discharge instructions, warning signs, and follow-up plan.")
    discharge_instructions: Optional[str] = Field(default=None, description="Clinician-authored discharge care directives.")
    warning_signs: Optional[str] = Field(default=None, description="Personalized post-discharge recovery warning signs.")
    follow_up_instructions: Optional[str] = Field(default=None, description="Follow-up clinical consultation instructions.")
    follow_up_date: Optional[str] = Field(default=None, description="Scheduled follow-up calendar date.")
    discharge_diagnosis: Optional[str] = Field(default=None, description="Primary clinical discharge diagnosis.")

    model_config = {"extra": "allow"}


class CDSEvaluateRequest(BaseModel):
    """
    Canonical request contract for the CDS Gateway orchestration layer (POST /cds/evaluate).
    """
    clinical_query: str = Field(
        ...,
        min_length=1,
        description="Clinician or patient clinical question / inquiry."
    )
    mode: str = Field(
        "doctor",
        description="Target clinical mode: 'doctor' (primary full CDS) or 'patient' (restricted patient health mode)."
    )
    patient_context: Optional[PatientContext] = Field(
        default=None,
        description="Sanitized request-scoped patient clinical context (data-minimized, no PII)."
    )
    candidate_medications: List[str] = Field(
        default_factory=list,
        description="Candidate or newly prescribed medications to screen for interactions alongside active meds."
    )
    retrieval_mode: str = Field(
        "hybrid",
        description="RAG retrieval pipeline mode: 'dense', 'bm25', 'hybrid', or 'hybrid_rerank'."
    )
    top_k: Optional[int] = Field(
        None,
        ge=1,
        le=50,
        description="Candidate evidence retrieval depth (default: dynamic query budgeting)."
    )
    language: Optional[str] = Field(
        "en",
        description="Target language: 'en' (English), 'hi' (Hindi), 'mr' (Marathi), or 'auto'."
    )
    conversation_history: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Bounded prior turns [{'role': 'user'|'assistant', 'content': str}] for pronoun and context resolution."
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_input(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Backward-compatibility alias: allow 'query' if 'clinical_query' is not explicitly passed
            if not data.get("clinical_query") and data.get("query"):
                data["clinical_query"] = data.get("query")
            if not data.get("mode"):
                data["mode"] = "doctor"

            raw_mode = str(data.get("mode", "doctor")).lower().strip()
            if raw_mode in ["receptionist", "admin", "administrative", "frontdesk"]:
                raise ValueError(
                    f"Non-clinical mode '{raw_mode}' is not permitted to access Clinical Decision Support. "
                    "Receptionist and administrative roles are strictly non-clinical."
                )
            if raw_mode not in ["doctor", "patient"]:
                raise ValueError(
                    f"Invalid CDS mode '{raw_mode}'. Permitted clinical modes are 'doctor' (Clinical Decision Support) "
                    "or 'patient' (Restricted Patient Health Mode)."
                )
            data["mode"] = raw_mode

            if not data.get("retrieval_mode"):
                data["retrieval_mode"] = "hybrid"
            if data.get("candidate_medications") is None:
                data["candidate_medications"] = []
        return data


class CDSCitation(BaseModel):
    """
    Authoritative evidence citation item matching the frozen RAG provenance format.
    """
    source_index: int
    title: str
    source_name: str
    publisher: str
    url: str
    chunk_id: str
    qtype: Optional[str] = None
    score: Optional[float] = None


class DrugInteractionAlert(BaseModel):
    """
    Deterministic drug-drug interaction alert derived from DrugBank/DailyMed rulebase.
    Never generated or overridden by the LLM.
    """
    drug_pair: List[str]
    severity: str
    explanation: str
    clinical_action: str
    source_id: str
    source_url: str
    rule_id: str
    provenance_status: str = "VERIFIED"


class CDSEvaluateResponse(BaseModel):
    """
    Unified CDS Gateway Response contract.
    Preserves exact RAG grounding statuses and attaches deterministic drug safety findings.
    """
    clinical_query: str
    answer: str
    verification_status: str = Field(
        ...,
        description="Authoritative status: 'grounded', 'partially_grounded', 'withheld_verification_failure', 'abstained_policy', 'emergency_diverted', 'prompt_injection_blocked'."
    )
    is_grounded: bool = Field(..., description="Whether the answer passed post-generation grounding verification.")
    is_emergency: bool = Field(False, description="Whether an acute clinical emergency was detected and diverted.")
    abstained: bool = Field(False, description="Whether the system safely abstained from answering.")
    citations: List[CDSCitation] = Field(default_factory=list, description="Verified medical monograph citations.")
    drug_interactions: List[DrugInteractionAlert] = Field(
        default_factory=list,
        description="Deterministic drug-drug interactions detected between active/candidate medications."
    )
    safety_alerts: List[str] = Field(default_factory=list, description="Summary clinical safety warning banners.")
    abstention_reason: Optional[str] = Field(None, description="Detailed clinical reason if system abstained.")
    execution_mode: str = Field("doctor", description="Mode under which query was evaluated ('doctor' or 'patient').")
    retrieved_chunks_count: int = 0
    pipeline_mode: str = "hybrid"
    language: str = Field("en", description="Output response language ('en', 'hi', 'mr').")
    detected_language: Optional[str] = Field(None, description="Automatically detected input query language.")
    canonical_query: Optional[str] = Field(None, description="Canonical English medical query used for RAG retrieval.")


# Auxiliary prescription screening models matching docs/API_SURFACE.md Section 3.2
class PrescriptionScreenRequest(BaseModel):
    allergies: List[str] = Field(default_factory=list, description="Documented patient allergies.")
    active_conditions: List[str] = Field(default_factory=list, description="Active diagnosed conditions.")
    candidate_medications: List[Union[str, Dict[str, Any]]] = Field(..., min_length=1, description="Proposed newly prescribed medications.")
    active_medications: Optional[List[Union[str, Dict[str, Any]]]] = Field(
        default_factory=list,
        description="Patient's current active medication regimen."
    )


class PrescriptionScreenResponse(BaseModel):
    screen_status: str  # "safe", "warning", "critical", "no_matching_local_rule"
    rule_coverage: str = Field(
        "FULL",
        description="Coverage status: 'FULL' (all drugs indexed), 'PARTIAL' (some unindexed), 'NO_MATCHING_LOCAL_RULE' (unsupported pair)."
    )
    interactions: List[DrugInteractionAlert] = Field(default_factory=list)
    contraindications: List[str] = Field(default_factory=list)
    duplicate_ingredients: List[Dict[str, Any]] = Field(default_factory=list)
    candidate_alternatives: List[Dict[str, Any]] = Field(default_factory=list)
    evaluated_drugs: List[Dict[str, Any]] = Field(default_factory=list)
    unindexed_drugs: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    clinical_disclaimer: str = Field(
        default="Deterministic screening reflects verified DailyMed SPL rules in local CDSS database. This screening does not replace clinician evaluation and does not guarantee complete absence of unindexed interactions."
    )
