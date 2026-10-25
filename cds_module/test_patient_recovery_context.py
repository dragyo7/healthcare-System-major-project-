from cds_module.models import DischargeRecord, PatientContext
from cds_module.orchestrator import CDSOrchestrator


def _resolve(query: str, context: PatientContext):
    return CDSOrchestrator(rag_pipeline=object(), interaction_dict={})._resolve_discharge_care_query(
        query_text=query,
        patient_context=context,
        effective_lang="en",
        detected_lang="en",
        canon_info={"original_query": query, "canonical_query": query, "was_canonicalized": False, "extracted_drugs": []},
        detected_interactions=[],
        safety_alerts=[],
    )


def test_general_recovery_question_uses_saved_discharge_plan():
    context = PatientContext(
        active_medications=[{"medicine_name": "Lisinopril", "dosage": "10 mg", "frequency": "once daily"}],
        discharge_record=DischargeRecord(
            has_discharge=True,
            discharge_diagnosis="Hypertension",
            discharge_instructions="Take Lisinopril 10 mg once daily in the morning.",
            warning_signs="Seek urgent care for chest pain or severe shortness of breath.",
            follow_up_instructions="Blood pressure review in two weeks.",
        ),
    )

    response = _resolve("What care should I take?", context)

    assert response is not None
    assert response.pipeline_mode == "discharge_care_grounding"
    assert response.is_grounded is True
    assert "Lisinopril 10 mg" in response.answer
    assert "Blood pressure review in two weeks" in response.answer

    paraphrase = _resolve("How should I care for myself at home?", context)
    assert paraphrase is not None
    assert "Lisinopril 10 mg" in paraphrase.answer

    follow_up = _resolve("What else should I watch for?", context)
    assert follow_up is not None
    assert "chest pain" in follow_up.answer


def test_general_recovery_question_without_plan_reports_missing_record():
    context = PatientContext(discharge_record=DischargeRecord(has_discharge=False))

    response = _resolve("What care should I take?", context)

    assert response is not None
    assert response.abstained is True
    assert response.citations == []
    assert "no hospital discharge" in response.answer.lower()

