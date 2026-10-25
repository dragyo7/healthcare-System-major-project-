"""Assert reproducible Synthea source-to-database identity mappings."""

import argparse
import json
import os

import mysql.connector


def verify(manifest_path: str, db_config: dict):
    with open(manifest_path, encoding="utf-8") as handle:
        patients = json.load(handle).get("patients") or []
    assert patients, "manifest has no patients"

    conn = mysql.connector.connect(**db_config)
    cur = conn.cursor(dictionary=True)
    seen_destinations = set()
    for source in patients:
        destination = source.get("destination") or {}
        user_id, patient_id = destination.get("user_id"), destination.get("patient_id")
        assert user_id and patient_id, f"missing destination mapping for {source.get('account_email')}"
        assert (user_id, patient_id) not in seen_destinations, "duplicate destination mapping"
        seen_destinations.add((user_id, patient_id))
        cur.execute(
            "SELECT u.email, p.date_of_birth, p.gender FROM users u JOIN patients p ON p.user_id = u.user_id WHERE u.user_id = %s AND p.patient_id = %s",
            (user_id, patient_id),
        )
        row = cur.fetchone()
        assert row, f"destination record missing for {source.get('account_email')}"
        assert row["email"] == source["account_email"], "patient/account linkage mismatch"
        actual_dob = str(row["date_of_birth"]) if row["date_of_birth"] else None
        assert actual_dob == source.get("dob"), "date-of-birth mapping mismatch"
        assert row["gender"] == source.get("gender"), "gender mapping mismatch"
        cur.execute("SELECT COUNT(*) AS count FROM users WHERE email = %s", (source["account_email"],))
        assert cur.fetchone()["count"] == 1, "duplicate imported account"
        cur.execute("SELECT COUNT(*) AS count FROM patients WHERE user_id = %s", (user_id,))
        assert cur.fetchone()["count"] == 1, "duplicate patient/account linkage"
        cur.execute(
            "SELECT COUNT(*) AS count FROM prescriptions WHERE patient_id = %s AND notes LIKE '[Synthea FHIR R4 Active Maintenance Regimen%%'",
            (patient_id,),
        )
        assert cur.fetchone()["count"] == 0, "legacy invented current prescription remains"
        cur.execute(
            "SELECT COUNT(*) AS count FROM appointments WHERE patient_id = %s AND doctor_id = 1 AND appointment_date = '2026-10-24' AND reason = 'Chronic disease maintenance and medication therapy review'",
            (patient_id,),
        )
        assert cur.fetchone()["count"] == 0, "legacy invented clinician appointment remains"
        cur.execute(
            "SELECT COUNT(*) AS count FROM discharges WHERE patient_id = %s AND discharge_summary = '[Doctor-Authored Demonstration Discharge Plan for Teacher Evaluation - Labeled Demo Care Plan]'",
            (patient_id,),
        )
        assert cur.fetchone()["count"] == 0, "legacy invented discharge plan remains"
        cur.execute("SELECT blood_group, emergency_contact FROM patients WHERE patient_id = %s", (patient_id,))
        demographics = cur.fetchone()
        assert demographics["blood_group"] != "O+", "legacy invented blood group remains"
        assert demographics["emergency_contact"] != "555-0199", "legacy invented emergency contact remains"
    conn.close()
    print(f"Verified {len(patients)} exact source/account mappings with no legacy invented prescriptions.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=os.getenv("SYNTHEA_MANIFEST"), required=os.getenv("SYNTHEA_MANIFEST") is None)
    parser.add_argument("--db-host", default=os.getenv("DB_HOST", "127.0.0.1"))
    parser.add_argument("--db-port", type=int, default=int(os.getenv("DB_PORT", "3306")))
    parser.add_argument("--db-user", default=os.getenv("DB_USER", "root"))
    parser.add_argument("--db-password", default=os.getenv("DB_PASSWORD"))
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "rag_healthcare_test"))
    args = parser.parse_args()
    verify(args.manifest, {"host": args.db_host, "port": args.db_port, "user": args.db_user, "password": args.db_password, "database": args.db_name})
