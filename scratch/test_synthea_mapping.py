from scratch.import_synthea_cohort import parse_bundle


def test_medication_request_preserves_fhir_regimen_and_status():
    bundle = {
        "entry": [
            {"resource": {"resourceType": "Patient", "id": "patient-1", "birthDate": "1970-01-01", "gender": "female"}},
            {
                "resource": {
                    "resourceType": "MedicationRequest",
                    "id": "med-1",
                    "status": "active",
                    "authoredOn": "2021-10-03T12:00:00Z",
                    "medicationCodeableConcept": {"text": "Example medicine 25 MG Oral Tablet"},
                    "dosageInstruction": [
                        {
                            "text": "Take one tablet twice daily with food.",
                            "timing": {"repeat": {"frequency": 2, "period": 1, "periodUnit": "d"}},
                            "doseAndRate": [{"doseQuantity": {"value": 1, "unit": "tablet"}}],
                            "route": {"text": "Oral route"},
                        }
                    ],
                }
            },
        ]
    }
    spec = {"display_name": "Example Patient"}

    parsed = parse_bundle(bundle, spec)
    medication = parsed["medication_requests"][0]

    assert medication["source_resource_id"] == "med-1"
    assert medication["status"] == "active"
    assert medication["dosage"] == "1 tablet"
    assert medication["frequency"] == "2 times per day"
    assert medication["route"] == "Oral route"
    assert medication["instructions"] == "Take one tablet twice daily with food."


def test_missing_regimen_fields_remain_unknown():
    bundle = {
        "entry": [
            {"resource": {"resourceType": "Patient", "id": "patient-2"}},
            {
                "resource": {
                    "resourceType": "MedicationRequest",
                    "id": "med-2",
                    "status": "active",
                    "medicationCodeableConcept": {"text": "Unmapped medicine"},
                }
            },
        ]
    }

    medication = parse_bundle(bundle, {"display_name": "Unknown Regimen"})["medication_requests"][0]

    assert medication["dosage"] is None
    assert medication["frequency"] is None
    assert medication["duration"] is None
    assert medication["instructions"] is None
