"""Preview or remove only records owned by one Synthea import manifest."""

import argparse
import json
import os

import mysql.connector


def run_cleanup(manifest_path: str, db_config: dict, apply: bool = False):
    with open(manifest_path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    entries = manifest.get("patients", [])
    expected = [
        (item.get("account_email"), item.get("destination") or {})
        for item in entries
        if (item.get("destination") or {}).get("user_id") and (item.get("destination") or {}).get("patient_id")
    ]
    if not expected:
        raise RuntimeError("Manifest contains no destination IDs; cleanup ownership cannot be established.")

    conn = mysql.connector.connect(**db_config)
    cur = conn.cursor(dictionary=True)
    owned = []
    for email, destination in expected:
        user_id, patient_id = destination["user_id"], destination["patient_id"]
        if "medical_history_ids" not in destination or "medical_report_ids" not in destination:
            conn.close()
            raise RuntimeError(f"Manifest lacks exact child-record ownership for {email}; cleanup refused.")
        cur.execute(
            "SELECT u.user_id, u.email, p.patient_id FROM users u JOIN patients p ON p.user_id = u.user_id WHERE u.user_id = %s AND p.patient_id = %s AND u.email = %s",
            (user_id, patient_id, email),
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            raise RuntimeError(f"Ownership mismatch for manifest mapping: {email}, user {user_id}, patient {patient_id}")
        row["medical_history_ids"] = destination["medical_history_ids"]
        row["medical_report_ids"] = destination["medical_report_ids"]
        owned.append(row)

    print(f"Exact import-owned records: {owned}")
    if not apply:
        conn.close()
        print("Preview only. Re-run with --apply to delete these exact manifest-owned records.")
        return

    try:
        conn.commit()
        conn.start_transaction()
        for row in owned:
            patient_id, user_id = row["patient_id"], row["user_id"]
            for history_id in row["medical_history_ids"]:
                cur.execute("DELETE FROM medical_history WHERE history_id = %s AND patient_id = %s", (history_id, patient_id))
            for report_id in row["medical_report_ids"]:
                cur.execute("DELETE FROM medical_reports WHERE report_id = %s AND patient_id = %s", (report_id, patient_id))
            for table in ("prescriptions", "discharges", "appointments", "medical_history", "medical_reports"):
                cur.execute(f"SELECT COUNT(*) AS count FROM {table} WHERE patient_id = %s", (patient_id,))
                if cur.fetchone()["count"]:
                    raise RuntimeError(f"Cleanup refused: patient {patient_id} has records not owned by this manifest in {table}.")
            cur.execute("DELETE FROM patients WHERE patient_id = %s AND user_id = %s", (patient_id, user_id))
            cur.execute("DELETE FROM users WHERE user_id = %s AND email = %s", (user_id, row["email"]))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=os.getenv("SYNTHEA_MANIFEST"), required=os.getenv("SYNTHEA_MANIFEST") is None)
    parser.add_argument("--db-host", default=os.getenv("DB_HOST", "127.0.0.1"))
    parser.add_argument("--db-port", type=int, default=int(os.getenv("DB_PORT", "3306")))
    parser.add_argument("--db-user", default=os.getenv("DB_USER", "root"))
    parser.add_argument("--db-password", default=os.getenv("DB_PASSWORD"))
    parser.add_argument("--db-name", default=os.getenv("DB_NAME", "rag_healthcare_test"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    run_cleanup(args.manifest, {"host": args.db_host, "port": args.db_port, "user": args.db_user, "password": args.db_password, "database": args.db_name}, apply=args.apply)
