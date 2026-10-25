"""
scratch/import_synthea_cohort.py

Idempotent FHIR R4 synthetic cohort mapper/importer for presentation use.
Maps five selected historical Synthea patient bundles into an explicitly selected
database without converting historical MedicationRequests into current treatment.

Enforces:
1. Strict dry-run preview mode (--dry-run).
2. Transactional writes and duplicate prevention.
3. Stable source-to-destination ID mapping in a generated manifest.
4. Exact FHIR dosageInstruction extraction; missing fields remain unknown.
5. Historical source dates and synthetic provenance remain explicit.
6. No invented prescriptions, clinician approvals, appointments, or discharge plans.
7. Archive and database configuration supplied by arguments/environment.
"""

import os
import sys
import json
import zipfile
import hashlib
import argparse
import datetime
import mysql.connector

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MANIFEST_PATH = os.path.join(REPO_ROOT, "audit_evidence", "synthea_cohort_manifest.json")

# Selected high-yield clinical cohort files
COHORT_SPECS = [
    {
        "file": "fhir/Terrilyn343_Murphy561_9ef4db86-c427-ddfe-a607-737f08ffb0c1.json",
        "display_name": "Terrilyn Murphy",
        "email": "synthea.terrilyn.murphy@demo.local",
        "has_discharge_plan": False,
        "notes": "Diabetic/Hypertensive maintenance patient with documented Aspirin/NSAID allergy. Missing discharge record."
    },
    {
        "file": "fhir/Trinh357_Sanford861_ce54be47-1a8f-e1eb-9b4d-ca61378d9f41.json",
        "display_name": "Trinh Sanford",
        "email": "synthea.trinh.sanford@demo.local",
        "has_discharge_plan": False,
        "notes": "Historical synthetic patient with documented Penicillin V allergy. No Synthea discharge plan."
    },
    {
        "file": "fhir/Brain142_Wuckert783_153c68e6-08e5-a751-1f6b-4439d279681d.json",
        "display_name": "Brain Wuckert",
        "email": "synthea.brain.wuckert@demo.local",
        "has_discharge_plan": False,
        "notes": "Cardiac risk patient with documented Sulfamethoxazole/Trimethoprim (Sulfa) allergy. Missing discharge record."
    },
    {
        "file": "fhir/Jospeh459_Gerhold939_55c5b8d3-99d0-58ad-8444-e42bb81bd5c7.json",
        "display_name": "Jospeh Gerhold",
        "email": "synthea.jospeh.gerhold@demo.local",
        "has_discharge_plan": False,
        "notes": "Multi-medication cardiovascular patient (Warfarin, Digoxin, Verapamil, Lisinopril). No documented allergies."
    },
    {
        "file": "fhir/Chauncey770_Jones311_1293efbb-72dc-8b15-3bd6-916f96ed54f4.json",
        "display_name": "Chauncey Jones",
        "email": "synthea.chauncey.jones@demo.local",
        "has_discharge_plan": False,
        "notes": "Metabolic syndrome maintenance patient. Baseline Metformin/Lisinopril. Missing discharge record."
    }
]

def calculate_sha256(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def _quantity_text(quantity: dict) -> str | None:
    if not isinstance(quantity, dict) or quantity.get("value") is None:
        return None
    unit = quantity.get("unit") or quantity.get("code")
    return f"{quantity['value']} {unit}".strip() if unit else str(quantity["value"])


def extract_medication_request(resource: dict) -> dict | None:
    """Map only facts present in a FHIR MedicationRequest; absent facts stay None."""
    concept = resource.get("medicationCodeableConcept") or {}
    coding = concept.get("coding") or [{}]
    name = concept.get("text") or coding[0].get("display")
    if not name:
        return None

    dosage_items = resource.get("dosageInstruction") or []
    dosage = dosage_items[0] if dosage_items else {}
    dose_and_rate = dosage.get("doseAndRate") or []
    dose_quantity = dose_and_rate[0].get("doseQuantity") if dose_and_rate else None
    repeat = (dosage.get("timing") or {}).get("repeat") or {}
    frequency = None
    if repeat.get("frequency") is not None:
        period = repeat.get("period", 1)
        unit = repeat.get("periodUnit")
        unit_names = {"d": "day", "wk": "week", "mo": "month", "h": "hour"}
        period_label = unit_names.get(unit, unit)
        if period_label:
            frequency = f"{repeat['frequency']} times per {period_label}" if period == 1 else f"{repeat['frequency']} times per {period} {period_label}s"

    duration = None
    bounds = repeat.get("boundsDuration") or {}
    if bounds.get("value") is not None:
        duration = _quantity_text(bounds)

    route = dosage.get("route") or {}
    route_coding = route.get("coding") or [{}]
    route_text = route.get("text") or route_coding[0].get("display")

    return {
        "source_resource_id": resource.get("id"),
        "status": resource.get("status"),
        "authored_on": resource.get("authoredOn"),
        "medicine_name": name,
        "dosage": _quantity_text(dose_quantity),
        "frequency": frequency,
        "duration": duration,
        "route": route_text,
        "instructions": dosage.get("text"),
    }

def format_safe_timestamp(date_str: str) -> str:
    """Formats date_str to MySQL TIMESTAMP valid range (1970 to 2037)."""
    try:
        if date_str and len(date_str) >= 4:
            year = int(date_str[:4])
            if 1970 <= year <= 2037:
                return f"{date_str[:10]} 10:00:00"
    except Exception:
        pass
    return "2021-10-01 10:00:00"

def parse_bundle(bundle_json: dict, spec: dict) -> dict:
    entries = bundle_json.get("entry", [])
    
    patient_res = None
    allergies = []
    conditions = []
    medication_requests = []
    observations = []
    encounters = []
    
    for e in entries:
        res = e.get("resource", {})
        rtype = res.get("resourceType")
        
        if rtype == "Patient":
            patient_res = res
        elif rtype == "AllergyIntolerance":
            c = res.get("code", {})
            txt = c.get("text") or (c.get("coding", [{}])[0].get("display"))
            if txt and txt not in allergies:
                allergies.append(txt)
        elif rtype == "Condition":
            c = res.get("code", {})
            txt = c.get("text") or (c.get("coding", [{}])[0].get("display"))
            status_codings = (res.get("clinicalStatus") or {}).get("coding") or []
            status = status_codings[0].get("code") if status_codings else None
            onset = res.get("onsetDateTime", "")[:10]
            if txt:
                # Filter out pure non-clinical social findings
                tl = txt.lower()
                if not any(ign in tl for ign in ["higher education", "employment", "criminal record", "transport problem", "high school"]):
                    conditions.append({"condition": txt, "onset": onset, "status": status})
        elif rtype == "MedicationRequest":
            medication = extract_medication_request(res)
            if medication:
                medication_requests.append(medication)
        elif rtype == "Encounter":
            etype = res.get("type", [{}])[0].get("text", "Encounter")
            start = res.get("period", {}).get("start", "")[:10]
            encounters.append({"type": etype, "start": start})
        elif rtype == "Observation":
            c = res.get("code", {})
            txt = c.get("text") or (c.get("coding", [{}])[0].get("display"))
            val = res.get("valueQuantity", {})
            val_str = f"{val.get('value')} {val.get('unit')}" if "value" in val else ""
            obs_date = res.get("effectiveDateTime", "")[:10]
            if txt in ["Blood Pressure", "Body Mass Index", "Glucose", "Hemoglobin A1c/Hemoglobin.total in Blood"]:
                observations.append({"test": txt, "value": val_str, "date": obs_date})
                
    # Demographics
    patient_res = patient_res or {}
    source_id = patient_res.get("id")
    dob = patient_res.get("birthDate")
    gender = patient_res.get("gender")
    addr_obj = patient_res.get("address", [{}])[0]
    line = addr_obj.get("line", [""])[0]
    city = addr_obj.get("city", "")
    state = addr_obj.get("state", "")
    address_str = f"{line}, {city}, {state}".strip(", ")
    phone = next(
        (item.get("value") for item in patient_res.get("telecom", []) if item.get("system") == "phone" and item.get("value")),
        None,
    )
    
    return {
        "spec": spec,
        "source_id": source_id,
        "dob": dob,
        "gender": gender,
        "address": address_str,
        "phone": phone,
        "allergies": allergies,
        "conditions": conditions,
        "medication_requests": medication_requests,
        "active_meds": [m for m in medication_requests if m["status"] == "active"],
        "historical_meds": [m for m in medication_requests if m["status"] != "active"],
        "observations": observations,
        "encounters": encounters
    }

def run_import(zip_path: str, manifest_path: str, db_config: dict, dry_run: bool = True, patient_password_hash: str | None = None):
    print("=================================================================")
    print(f"Synthea FHIR R4 Presentation Cohort Importer {'(DRY RUN)' if dry_run else '(LIVE EXECUTION)'}")
    print("=================================================================")
    print(f"Source ZIP: {zip_path}")
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"Source archive not found: {zip_path}")
        
    archive_hash = calculate_sha256(zip_path)
    print(f"Archive SHA256: {archive_hash}")
    
    parsed_cohort = []
    with zipfile.ZipFile(zip_path, "r") as z:
        for spec in COHORT_SPECS:
            with z.open(spec["file"]) as f:
                b_json = json.load(f)
                parsed = parse_bundle(b_json, spec)
                parsed_cohort.append(parsed)
                
    print(f"\nParsed {len(parsed_cohort)} selected patient bundles.")
    
    conn = mysql.connector.connect(**db_config)
    cur = conn.cursor(dictionary=True)
    
    # Check existing accounts to guarantee duplicate prevention
    existing_emails = set()
    cur.execute("SELECT email, user_id FROM users")
    for row in cur.fetchall():
        existing_emails.add(row["email"])
        
    print(f"Existing accounts in rag_healthcare_test: {len(existing_emails)}")
    
    manifest_records = []
    
    for p in parsed_cohort:
        spec = p["spec"]
        email = spec["email"]
        disp_name = spec["display_name"]
        
        print("\n-------------------------------------------------------------")
        print(f"Candidate: {disp_name} <{email}>")
        print(f"  Source UUID: {p['source_id']}")
        print(f"  DOB: {p['dob']} | Gender: {p['gender']}")
        print(f"  Documented Allergies ({len(p['allergies'])}): {p['allergies']}")
        print(f"  Active Conditions ({len(p['conditions'])}): {[c['condition'] for c in p['conditions'][:3]]}")
        medication_names = [m["medicine_name"] for m in p["medication_requests"]]
        preview_suffix = " ..." if len(medication_names) > 5 else ""
        print(f"  Historical MedicationRequests ({len(medication_names)}): {medication_names[:5]}{preview_suffix}")
        print("  Synthea Discharge Plan: NONE")
        
        is_already_imported = email in existing_emails
        print(f"  Status: {'ALREADY IMPORTED' if is_already_imported else 'READY FOR INSERT'}")
        
        manifest_records.append({
            "source_file": spec["file"],
            "source_patient_uuid": p["source_id"],
            "display_name": disp_name,
            "account_email": email,
            "dob": p["dob"],
            "gender": p["gender"],
            "allergies_count": len(p["allergies"]),
            "allergies_documented": p["allergies"],
            "source_conditions": p["conditions"],
            "source_medication_requests": p["medication_requests"],
            "has_synthea_discharge_record": False,
            "historical_meds_count": len(p["historical_meds"]),
            "historical_encounters_count": len(p["encounters"]),
            "omitted_fields": [
                "Claims", "ExplanationOfBenefit", "InsuranceProvider",
                "Non-clinical employment findings", "Historic inactive encounters",
                "DocumentReference LOINC 34117-2 notes (clinical encounter notes, not discharge directives)"
            ],
            "destination": {"user_id": None, "patient_id": None, "medical_history_ids": [], "medical_report_ids": []},
            "action": "EXISTS" if is_already_imported else ("WOULD_INSERT" if dry_run else "INSERTED")
        })

    # Resolve stable destination mappings for records that already exist.
    for record in manifest_records:
        cur.execute(
            "SELECT u.user_id, p.patient_id FROM users u LEFT JOIN patients p ON p.user_id = u.user_id WHERE u.email = %s",
            (record["account_email"],),
        )
        destination = cur.fetchone()
        if destination:
            record["destination"].update(destination)

    def write_manifest():
        manifest_data = {
            "import_metadata": {
                "source_archive": os.path.abspath(zip_path),
                "archive_sha256": archive_hash,
                "import_timestamp": datetime.datetime.now().isoformat(),
                "target_database": db_config["database"],
                "time_policy": "Historical Synthea source dates retained; missing dates remain unavailable.",
                "clinical_status_policy": "MedicationRequests remain historical source data; no current prescription or clinician approval is inferred.",
                "imported_cohort_count": len(manifest_records),
            },
            "patients": manifest_records,
        }
        os.makedirs(os.path.dirname(os.path.abspath(manifest_path)), exist_ok=True)
        with open(manifest_path, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2)
        print(f"\nImport manifest saved to: {manifest_path}")

    if dry_run:
        conn.close()
        write_manifest()
        print("[DRY RUN COMPLETE] Zero database modifications performed.")
        return
        
    print("\nExecuting transactional database inserts...")
    try:
        conn.autocommit = False
        
        inserted_patients = 0
        
        for p in parsed_cohort:
            spec = p["spec"]
            email = spec["email"]
            if email in existing_emails:
                print(f"Skipping existing user {email}")
                continue
            if not patient_password_hash:
                raise RuntimeError("A bcrypt patient password hash is required for live inserts via --patient-password-hash or SYNTHEA_PATIENT_PASSWORD_HASH.")
                
            # 1. Insert into users
            sql_user = """
                INSERT INTO users (full_name, email, password, role, phone, created_at, consent_timestamp, consent_version)
                VALUES (%s, %s, %s, 'patient', %s, NOW(), NULL, NULL)
            """
            cur.execute(sql_user, (spec["display_name"], email, patient_password_hash, p["phone"]))
            new_user_id = cur.lastrowid
            
            # 2. Insert into patients
            allergies_str = ", ".join(p["allergies"]) if p["allergies"] else None
            sql_patient = """
                INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
                VALUES (%s, %s, %s, NULL, %s, NULL, %s)
            """
            cur.execute(sql_patient, (new_user_id, p["dob"], p["gender"], p["address"], allergies_str))
            new_patient_id = cur.lastrowid
            
            inserted_history_ids = []
            inserted_report_ids = []

            # 3. Insert conditions into medical_history
            for cond in p["conditions"][:5]:
                onset = cond["onset"] or None
                sql_hist = """
                    INSERT INTO medical_history (patient_id, condition_name, diagnosis, diagnosed_date, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """
                notes = f"[Synthea FHIR R4 Cohort; Status: {cond['status']}; Provenance: synthetic_sample_fhir_r4]"
                cur.execute(sql_hist, (new_patient_id, cond["condition"], cond["condition"], onset, notes))
                inserted_history_ids.append(cur.lastrowid)
                
            # MedicationRequests remain historical source records in the manifest.
            # They are deliberately not converted into current prescriptions: a FHIR
            # request status at the 2021 snapshot does not prove current use or clinician review.

            # Insert source observations only when the FHIR bundle contains them.
            if p["observations"]:
                obs_summary_lines = [f"{o['test']}: {o['value']} ({o['date']})" for o in p["observations"][:4]]
                report_date = next((o["date"] for o in p["observations"] if o["date"]), None)
                sql_rep = """
                    INSERT INTO medical_reports (patient_id, report_type, report_name, report_date, report_summary, file_path)
                    VALUES (%s, 'LAB', 'Historical Synthea observation summary', %s, %s, NULL)
                """
                cur.execute(sql_rep, (new_patient_id, report_date, " | ".join(obs_summary_lines)))
                inserted_report_ids.append(cur.lastrowid)
                
            print(f"  No prescription, appointment, clinician approval, blood group, emergency contact, or discharge plan was invented for patient {new_patient_id}")

            record = next(item for item in manifest_records if item["account_email"] == email)
            record["destination"] = {
                "user_id": new_user_id,
                "patient_id": new_patient_id,
                "medical_history_ids": inserted_history_ids,
                "medical_report_ids": inserted_report_ids,
            }
                
            inserted_patients += 1
            print(f"Successfully inserted patient {spec['display_name']} (User ID: {new_user_id}, Patient ID: {new_patient_id})")
            
        conn.commit()
        print(f"\nTransaction committed successfully. Inserted {inserted_patients} patients.")
        
    except Exception:
        conn.rollback()
        conn.close()
        raise
        
    conn.close()
    
    write_manifest()
    print("Idempotent import completed successfully.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Synthea FHIR R4 presentation cohort")
    parser.add_argument("--archive", default=os.getenv("SYNTHEA_ARCHIVE"), help="Path to the Synthea FHIR R4 ZIP archive")
    parser.add_argument("--manifest", default=os.getenv("SYNTHEA_MANIFEST", DEFAULT_MANIFEST_PATH))
    parser.add_argument("--db-host", default=os.getenv("DB_HOST", "127.0.0.1"))
    parser.add_argument("--db-port", type=int, default=int(os.getenv("DB_PORT", "3306")))
    parser.add_argument("--db-user", default=os.getenv("DB_USER", "root"))
    parser.add_argument("--db-password", default=os.getenv("DB_PASSWORD"))
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "rag_healthcare_test"))
    parser.add_argument("--patient-password-hash", default=os.getenv("SYNTHEA_PATIENT_PASSWORD_HASH"))
    parser.add_argument("--dry-run", action="store_true", help="Preview mapping outcomes without modifying database")
    parser.add_argument("--live", action="store_true", help="Execute live transactional database writes")
    args = parser.parse_args()
    
    # Default to dry-run unless --live explicitly passed
    is_dry = not args.live
    if not args.archive:
        parser.error("--archive or SYNTHEA_ARCHIVE is required")
    run_import(
        zip_path=args.archive,
        manifest_path=args.manifest,
        db_config={
            "host": args.db_host,
            "port": args.db_port,
            "user": args.db_user,
            "password": args.db_password,
            "database": args.db_name,
        },
        dry_run=is_dry,
        patient_password_hash=args.patient_password_hash,
    )
