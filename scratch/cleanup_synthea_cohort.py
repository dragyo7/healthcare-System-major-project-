"""
scratch/cleanup_synthea_cohort.py

Scoped cleanup script that removes ONLY imported Synthea demonstration records
from rag_healthcare_test. Leaves existing baseline accounts completely untouched.
"""

import sys
import mysql.connector

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def run_cleanup():
    db_config = {
        "host": "localhost",
        "user": "root",
        "password": "bhumi",
        "database": "rag_healthcare_test"
    }
    
    conn = mysql.connector.connect(**db_config)
    cur = conn.cursor(dictionary=True)
    
    print("Finding Synthea demo accounts in rag_healthcare_test...")
    cur.execute("SELECT user_id, full_name, email FROM users WHERE email LIKE 'synthea.%@demo.local'")
    users = cur.fetchall()
    
    if not users:
        print("No Synthea demo accounts found. Database is already clean.")
        conn.close()
        return
        
    user_ids = [u["user_id"] for u in users]
    print(f"Found {len(user_ids)} Synthea demo users: {[u['email'] for u in users]}")
    
    # Find associated patient_ids
    cur.execute(f"SELECT patient_id FROM patients WHERE user_id IN ({','.join(str(i) for i in user_ids)})")
    patients = cur.fetchall()
    patient_ids = [p["patient_id"] for p in patients]
    print(f"Found {len(patient_ids)} associated patient records: {patient_ids}")
    
    try:
        conn.start_transaction()
        if patient_ids:
            p_in = ','.join(str(i) for i in patient_ids)
            
            # Find prescription_ids
            cur.execute(f"SELECT prescription_id FROM prescriptions WHERE patient_id IN ({p_in})")
            rx_ids = [r["prescription_id"] for r in cur.fetchall()]
            if rx_ids:
                rx_in = ','.join(str(i) for i in rx_ids)
                cur.execute(f"DELETE FROM prescription_medicines WHERE prescription_id IN ({rx_in})")
                print(f"Deleted prescription_medicines for prescriptions: {rx_ids}")
                
            cur.execute(f"DELETE FROM prescriptions WHERE patient_id IN ({p_in})")
            print("Deleted prescriptions.")
            cur.execute(f"DELETE FROM discharges WHERE patient_id IN ({p_in})")
            print("Deleted discharges.")
            cur.execute(f"DELETE FROM appointments WHERE patient_id IN ({p_in})")
            print("Deleted appointments.")
            cur.execute(f"DELETE FROM medical_history WHERE patient_id IN ({p_in})")
            print("Deleted medical_history.")
            cur.execute(f"DELETE FROM medical_reports WHERE patient_id IN ({p_in})")
            print("Deleted medical_reports.")
            cur.execute(f"DELETE FROM patients WHERE patient_id IN ({p_in})")
            print("Deleted patients.")
            
        cur.execute(f"DELETE FROM users WHERE user_id IN ({','.join(str(i) for i in user_ids)})")
        print("Deleted users.")
        
        conn.commit()
        print("\nCleanup transaction committed successfully. All Synthea demo records removed cleanly.")
    except Exception as ex:
        conn.rollback()
        print(f"ERROR: Cleanup failed and rolled back: {ex}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_cleanup()
