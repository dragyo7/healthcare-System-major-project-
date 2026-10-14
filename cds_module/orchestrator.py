"""
CDS Gateway Orchestrator: Central Coordination Service.
Coordinates the frozen RAG pipeline, deterministic drug interaction engine,
and request-scoped clinical context.
Fail-closed, strictly stateless, with zero patient vector storage in the global corpus.
"""
import logging
import re
from typing import Optional, List, Dict, Any, Union

from cds_module.models import (
    CDSEvaluateRequest,
    CDSEvaluateResponse,
    CDSCitation,
    DrugInteractionAlert,
    PatientContext,
    PrescriptionScreenRequest,
    PrescriptionScreenResponse
)

logger = logging.getLogger("cds_module.orchestrator")


class CDSOrchestrator:
    """
    Stateless clinical decision support coordinator.
    Delegates medical knowledge retrieval to MedicalRAGPipeline and drug safety
    to deterministic DrugBank rule engines.
    """

    def __init__(self, rag_pipeline=None, interaction_dict: Optional[Dict[Any, Any]] = None):
        self._rag_pipeline = rag_pipeline
        self._interaction_dict = interaction_dict

    @property
    def rag_pipeline(self):
        if self._rag_pipeline is None:
            from rag_module.api import get_legacy_pipeline
            self._rag_pipeline = get_legacy_pipeline()
        return self._rag_pipeline

    @property
    def interaction_dict(self):
        if self._interaction_dict is None:
            from drug_module.data_loader import load_drugbank
            self._interaction_dict = load_drugbank()
        return self._interaction_dict

    def _extract_drugs_from_request(self, request: CDSEvaluateRequest) -> List[str]:
        """
        Extracts medication names from candidate list, request-scoped patient context,
        and known clinical entities mentioned in the query.
        """
        drugs: List[str] = []

        # 1. Explicit candidate medications
        for cand in request.candidate_medications:
            if cand and str(cand).strip():
                drugs.append(str(cand).strip())

        # 2. Active medications from patient context
        if request.patient_context and request.patient_context.active_medications:
            for med in request.patient_context.active_medications:
                if isinstance(med, str):
                    name = med.strip()
                    if name and name not in drugs:
                        drugs.append(name)
                elif isinstance(med, dict):
                    name = med.get("name") or med.get("medicine_name") or med.get("drug")
                    if name and str(name).strip() and str(name).strip() not in drugs:
                        drugs.append(str(name).strip())

        # 3. Known drugs in the deterministic rules mentioned in the clinical query
        if request.clinical_query and self.interaction_dict:
            for known_drug in self.interaction_dict.keys():
                pattern = r'\b' + re.escape(str(known_drug)) + r'\b'
                if re.search(pattern, request.clinical_query, re.IGNORECASE):
                    if not any(d.lower() == str(known_drug).lower() for d in drugs):
                        drugs.append(str(known_drug).capitalize())

        return drugs

    def evaluate(self, request: CDSEvaluateRequest) -> CDSEvaluateResponse:
        """
        Main orchestration flow:
        1. Input Validation
        2. Emergency Triage Check (Early Interception)
        3. Prompt-Injection Defense (Early Block)
        4. Deterministic Drug Safety Screening (Rule-Based, Non-LLM)
        5. Request-Scoped Clinical Context Packaging (Data-Minimization)
        6. Frozen RAG Pipeline Invocation
        7. Grounding Status Mapping & Final Assembly
        """
        query_text = request.clinical_query.strip()
        if not query_text:
            return CDSEvaluateResponse(
                clinical_query="",
                answer="Clinical query cannot be empty.",
                verification_status="abstained_policy",
                is_grounded=False,
                is_emergency=False,
                abstained=True,
                abstention_reason="Empty query provided."
            )

        # Multilingual Processing Layer
        from multilingual_module.detector import detect_language, is_indic_emergency, is_indic_prompt_injection
        from multilingual_module.canonicalizer import canonicalize_medical_query
        from multilingual_module.localizer import localize_cds_response

        detected_info = detect_language(query_text)
        req_lang = getattr(request, "language", "en")
        effective_lang = req_lang if (req_lang and req_lang != "auto") else detected_info["language"]

        # Canonicalize to English for the frozen RAG engine if input is Indic
        canon_info = canonicalize_medical_query(query_text, forced_lang=effective_lang)
        retrieval_query = canon_info["canonical_query"] if canon_info["was_canonicalized"] else query_text

        # Step 2: Emergency Triage Check (evaluated on raw, canonical, and Indic patterns)
        emergency_alert = (
            self.rag_pipeline.guardrails.check_emergency(retrieval_query)
            or self.rag_pipeline.guardrails.check_emergency(query_text)
            or (is_indic_emergency(query_text) and "🚨 MEDICAL EMERGENCY DETECTED 🚨")
        )
        if emergency_alert:
            early_res = CDSEvaluateResponse(
                clinical_query=query_text,
                answer="🚨 **MEDICAL EMERGENCY DETECTED** 🚨\n\nYour description suggests symptoms that may require **immediate medical attention**.",
                verification_status="emergency_diverted",
                is_grounded=False,
                is_emergency=True,
                abstained=False,
                citations=[],
                drug_interactions=[],
                safety_alerts=["CRITICAL ALERT: Acute medical emergency detected. Diverted to emergency protocols."],
                abstention_reason="Acute emergency triage diversion.",
                execution_mode=request.mode,
                pipeline_mode="emergency_triage",
                language=effective_lang,
                detected_language=detected_info["language"],
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )
            if effective_lang != "en":
                return CDSEvaluateResponse(**localize_cds_response(early_res.model_dump(), target_lang=effective_lang))
            return early_res

        # Step 3: Prompt Injection Early Blocking
        is_inj = (
            self.rag_pipeline.guardrails.detect_injection(retrieval_query)
            or self.rag_pipeline.guardrails.detect_injection(query_text)
            or is_indic_prompt_injection(query_text)
        )
        if is_inj:
            early_res = CDSEvaluateResponse(
                clinical_query=query_text,
                answer="Security Alert: Request blocked. This system cannot process prompts attempting to override or inspect system instructions.",
                verification_status="prompt_injection_blocked",
                is_grounded=False,
                is_emergency=False,
                abstained=True,
                citations=[],
                drug_interactions=[],
                safety_alerts=["SECURITY ALERT: Prompt injection attempt intercepted and blocked."],
                abstention_reason="Prompt injection detected.",
                execution_mode=request.mode,
                pipeline_mode="prompt_injection_blocked",
                language=effective_lang,
                detected_language=detected_info["language"],
                canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
            )
            if effective_lang != "en":
                return CDSEvaluateResponse(**localize_cds_response(early_res.model_dump(), target_lang=effective_lang))
            return early_res

        # Step 4: Deterministic Drug Safety Screening
        drug_list = self._extract_drugs_from_request(request)
        # Also include any extracted drugs from canonicalized query
        for d in canon_info.get("extracted_drugs", []):
            if d.capitalize() not in drug_list and d not in drug_list:
                drug_list.append(d.capitalize())
        detected_interactions: List[DrugInteractionAlert] = []
        safety_alerts: List[str] = []

        if len(drug_list) >= 2:
            try:
                from drug_module.interaction_engine import check_interactions
                raw_interactions = check_interactions(drug_list, self.interaction_dict)
                for item in raw_interactions:
                    alert = DrugInteractionAlert(
                        drug_pair=item.get("drug_pair", []),
                        severity=str(item.get("severity", "moderate")),
                        explanation=str(item.get("explanation", "")),
                        clinical_action=str(item.get("clinical_action", "")),
                        source_id=str(item.get("source_id", "DailyMed")),
                        source_url=str(item.get("source_url", "")),
                        rule_id=str(item.get("rule_id", "")),
                        provenance_status=str(item.get("provenance_status", "VERIFIED"))
                    )
                    detected_interactions.append(alert)
                    pair_str = " + ".join(alert.drug_pair)
                    safety_alerts.append(
                        f"DRUG INTERACTION ({alert.severity.upper()}): {pair_str}. {alert.clinical_action}"
                    )
            except Exception as e:
                logger.error(f"Drug safety screening error: {e}", exc_info=True)
                safety_alerts.append("Notice: Deterministic drug interaction engine encountered a lookup error.")

        # Step 5: Request-Scoped Context Packaging (No PII, never indexed)
        patient_context_dict: Dict[str, Any] = {}
        if request.patient_context:
            if request.patient_context.age is not None:
                patient_context_dict["age"] = request.patient_context.age
            if request.patient_context.gender:
                patient_context_dict["gender"] = request.patient_context.gender
            if request.patient_context.symptoms:
                patient_context_dict["symptoms"] = request.patient_context.symptoms
            if request.patient_context.diagnoses:
                patient_context_dict["diagnoses"] = request.patient_context.diagnoses
            if request.patient_context.allergies:
                patient_context_dict["allergies"] = request.patient_context.allergies
            if request.patient_context.active_medications:
                patient_context_dict["active_medications"] = request.patient_context.active_medications
            if request.patient_context.medical_history:
                patient_context_dict["medical_history"] = request.patient_context.medical_history
            if request.patient_context.lab_summaries:
                patient_context_dict["lab_summaries"] = request.patient_context.lab_summaries

        # Step 6: Invoke Frozen Medical RAG Pipeline
        rag_res = self.rag_pipeline.query(
            user_query=retrieval_query,
            mode=request.retrieval_mode,
            top_k=request.top_k,
            generate_answer=True,
            verify_answer=True,
            audience=request.mode,
            patient_context=patient_context_dict
        )

        # Step 7: Grounding Status Mapping & Response Assembly
        verification = rag_res.get("verification")
        is_grounded = bool(verification.get("is_grounded", False)) if verification else (
            not rag_res.get("abstained", False) and not rag_res.get("is_emergency", False)
        )
        abstained = bool(rag_res.get("abstained", False))

        if rag_res.get("is_emergency", False):
            verification_status = "emergency_diverted"
        elif rag_res.get("grounding_status") == "prompt_injection_blocked":
            verification_status = "prompt_injection_blocked"
        elif not abstained and is_grounded:
            verification_status = "grounded"
        elif not abstained and verification and verification.get("safe_for_partial", False):
            verification_status = "partially_grounded"
            is_grounded = True
        elif verification and not verification.get("is_grounded", False):
            verification_status = "withheld_verification_failure"
            abstained = True
        else:
            verification_status = "abstained_policy"
            abstained = True

        # Map Citations
        citations: List[CDSCitation] = []
        for src in rag_res.get("sources", []):
            if isinstance(src, dict):
                # Patient Mode: Omit internal system traces (chunk_ids and raw retrieval scores)
                chunk_id_val = "" if request.mode == "patient" else str(src.get("chunk_id", ""))
                score_val = None if request.mode == "patient" else (float(src.get("score")) if src.get("score") is not None else None)
                qtype_val = None if request.mode == "patient" else src.get("qtype")

                citations.append(CDSCitation(
                    source_index=src.get("source_index", len(citations) + 1),
                    title=src.get("title", "Clinical Evidence"),
                    source_name=src.get("source_name", "Authoritative Guideline"),
                    publisher=src.get("publisher", "Medical Authority"),
                    url=src.get("url", ""),
                    chunk_id=chunk_id_val,
                    qtype=qtype_val,
                    score=score_val
                ))

        answer_text = rag_res.get("answer", "")
        abstention_reason = None
        if abstained:
            if request.mode == "patient":
                abstention_reason = "Evidence insufficient or verification threshold not met for safe patient guidance."
                answer_text = (
                    "The medical guidelines do not contain sufficient verified evidence to answer this question safely for personal care. "
                    "For your health and safety, please consult your treating physician or a qualified healthcare professional."
                )
            else:
                abstention_reason = "Evidence insufficient or verification threshold not met for safe clinical claim."
        elif request.mode == "patient" and not rag_res.get("is_emergency", False):
            # Patient Educational Safe Mode: Append disclaimer if not already included
            if "Note:" not in answer_text and "consult" not in answer_text.lower():
                answer_text += "\n\nNote: This information is for personal health education only and does not replace professional medical judgment from your doctor."

        assembled_response = CDSEvaluateResponse(
            clinical_query=query_text,
            answer=answer_text,
            verification_status=verification_status,
            is_grounded=is_grounded,
            is_emergency=bool(rag_res.get("is_emergency", False)),
            abstained=abstained,
            citations=citations,
            drug_interactions=detected_interactions,
            safety_alerts=safety_alerts,
            abstention_reason=abstention_reason,
            execution_mode=request.mode,
            retrieved_chunks_count=rag_res.get("retrieved_chunks_count", len(citations)),
            pipeline_mode=rag_res.get("pipeline_mode", request.retrieval_mode),
            language=effective_lang,
            detected_language=detected_info["language"],
            canonical_query=canon_info["canonical_query"] if canon_info["was_canonicalized"] else None
        )

        if effective_lang != "en":
            localized_data = localize_cds_response(assembled_response.model_dump(), target_lang=effective_lang)
            return CDSEvaluateResponse(**localized_data)

        return assembled_response

    def screen_prescription(self, request: PrescriptionScreenRequest) -> PrescriptionScreenResponse:
        """
        Deterministic prescription screening endpoint (DrugBank + Allergy/Condition matching).
        """
        drug_names = []
        for med in request.candidate_medications:
            if isinstance(med, str):
                drug_names.append(med.strip())
            elif isinstance(med, dict):
                name = med.get("name") or med.get("medicine_name") or med.get("drug")
                if name:
                    drug_names.append(str(name).strip())

        interactions: List[DrugInteractionAlert] = []
        if len(drug_names) >= 2:
            from drug_module.interaction_engine import check_interactions
            raw_interactions = check_interactions(drug_names, self.interaction_dict)
            for item in raw_interactions:
                interactions.append(DrugInteractionAlert(
                    drug_pair=item.get("drug_pair", []),
                    severity=str(item.get("severity", "moderate")),
                    explanation=str(item.get("explanation", "")),
                    clinical_action=str(item.get("clinical_action", "")),
                    source_id=str(item.get("source_id", "DailyMed")),
                    source_url=str(item.get("source_url", "")),
                    rule_id=str(item.get("rule_id", "")),
                    provenance_status=str(item.get("provenance_status", "VERIFIED"))
                ))

        contraindications = []
        # Check simple allergy contraindication
        for drug in drug_names:
            for allergy in request.allergies:
                if allergy.lower() in drug.lower() or drug.lower() in allergy.lower():
                    contraindications.append(f"ALLERGY CONTRAINDICATION: Patient has documented allergy to '{allergy}', matching candidate drug '{drug}'.")

        screen_status = "safe"
        if contraindications:
            screen_status = "critical"
        elif any(i.severity.lower() in ["high", "critical", "major"] for i in interactions):
            screen_status = "warning"
        elif interactions:
            screen_status = "warning"

        recommendations = [i.clinical_action for i in interactions if i.clinical_action]

        return PrescriptionScreenResponse(
            screen_status=screen_status,
            interactions=interactions,
            contraindications=contraindications,
            recommendations=recommendations
        )


_global_orchestrator: Optional[CDSOrchestrator] = None


def get_cds_orchestrator() -> CDSOrchestrator:
    global _global_orchestrator
    if _global_orchestrator is None:
        _global_orchestrator = CDSOrchestrator()
    return _global_orchestrator
