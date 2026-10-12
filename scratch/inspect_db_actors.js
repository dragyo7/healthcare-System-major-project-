require("dotenv").config({ path: "E:/Major Project Code/Portal Major P/Bhumi/Doctor portal/backend/.env" });
const mysql = require("mysql2/promise");

async function inspect() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log("=== USERS ===");
    const [users] = await conn.execute("SELECT user_id, full_name, email, role, phone FROM users");
    console.table(users);

    console.log("=== DOCTORS ===");
    const [doctors] = await conn.execute("SELECT doctor_id, user_id, specialization, qualification, license_number FROM doctors");
    console.table(doctors);

    console.log("=== PATIENTS ===");
    const [patients] = await conn.execute("SELECT patient_id, user_id, date_of_birth, gender FROM patients");
    console.table(patients);

    console.log("=== APPOINTMENTS ===");
    const [appointments] = await conn.execute("SELECT appointment_id, doctor_id, patient_id, appointment_date, status FROM appointments");
    console.table(appointments);

    console.log("=== PRESCRIPTIONS ===");
    const [prescriptions] = await conn.execute("SELECT prescription_id, doctor_id, patient_id, prescription_date FROM prescriptions");
    console.table(prescriptions);

    console.log("=== MEDICAL REPORTS ===");
    const [reports] = await conn.execute("SELECT report_id, patient_id, report_type, report_name, file_path FROM medical_reports");
    console.table(reports);

    console.log("=== TABLES IN DATABASE ===");
    const [tables] = await conn.execute("SHOW TABLES");
    console.table(tables);

    await conn.end();
}

inspect().catch(err => {
    console.error("Error inspecting database:", err);
    process.exit(1);
});
