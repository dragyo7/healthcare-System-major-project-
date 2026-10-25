import mysql.connector

conn = mysql.connector.connect(host='localhost', user='root', password='bhumi', database='rag_healthcare_test')
cur = conn.cursor(dictionary=True)

query = """
SELECT u.user_id, p.patient_id, u.full_name, u.email, p.date_of_birth, p.gender, p.allergies
FROM users u
JOIN patients p ON u.user_id = p.user_id
WHERE u.email LIKE 'synthea.%@demo.local'
ORDER BY p.patient_id
"""
cur.execute(query)
patients = cur.fetchall()
print(f"Total Synthea Patients in DB: {len(patients)}")
for pat in patients:
    pid = pat['patient_id']
    print("-----------------------------------------------------------------")
    print(f"Patient ID: {pid} | User ID: {pat['user_id']} | Name: {pat['full_name']}")
    print(f"  Email: {pat['email']} | DOB: {pat['date_of_birth']} | Gender: {pat['gender']}")
    print(f"  Allergies: {pat['allergies']}")
    
    # Check conditions
    cur.execute("SELECT condition_name, diagnosed_date FROM medical_history WHERE patient_id = %s", (pid,))
    conds = cur.fetchall()
    print(f"  Conditions ({len(conds)}): {[c['condition_name'] for c in conds]}")
    
    # Check prescriptions
    cur.execute("""
        SELECT pr.prescription_id, pr.diagnosis, pr.prescription_date, pr.notes,
               pm.medicine_name, pm.dosage, pm.frequency, pm.instructions
        FROM prescriptions pr
        LEFT JOIN prescription_medicines pm ON pr.prescription_id = pm.prescription_id
        WHERE pr.patient_id = %s
    """, (pid,))
    meds = cur.fetchall()
    print(f"  Active Prescribed Medicines ({len(meds)}):")
    for m in meds:
        print(f"    - {m['medicine_name']} {m['dosage']} ({m['frequency']}): {m['instructions']}")
        
    # Check appointment with Doctor 1
    cur.execute("SELECT appointment_id, doctor_id, appointment_date, status FROM appointments WHERE patient_id = %s", (pid,))
    apts = cur.fetchall()
    print(f"  Appointments with Doctor 1: {apts}")
    
    # Check discharge record
    cur.execute("SELECT discharge_id, diagnosis, discharge_instructions, warning_signs FROM discharges WHERE patient_id = %s", (pid,))
    ds = cur.fetchall()
    if ds:
        print(f"  Discharge Plan: Present (ID: {ds[0]['discharge_id']})")
        print(f"    Instructions: {ds[0]['discharge_instructions'][:80]}...")
        print(f"    Warning Signs: {ds[0]['warning_signs'][:80]}...")
    else:
        print("  Discharge Plan: NONE (Honest Abstention)")

conn.close()
