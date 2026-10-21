/**
 * scripts/seed_disposable_test_db.js
 *
 * Sets up and populates 'rag_healthcare_test' with clean schema migrations
 * and synthetic clinical test fixtures.
 *
 * STRICT INVARIANTS:
 * 1. Requires process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true"
 * 2. Strictly refuses execution if DB_NAME !== 'rag_healthcare_test'
 * 3. Uses cdss_test_user credentials from scratch/test_db_config.json
 * 4. Never touches or affects primary 'rag_healthcare' database
 */

const fs = require("fs");
const path = require("path");
const bcrypt = require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/bcrypt"));
const mysql = require(path.join(__dirname, "../Portal Major P/Bhumi/Doctor portal/backend/node_modules/mysql2/promise"));

const { verifyDestructiveTestSafety, verifyTestDatabasePreflight } = require("../tests/safety/databaseSafetyGuard");

async function main() {
    console.log("==========================================================================");
    console.log("       SYNTHETIC TEST FIXTURE & SCHEMA MIGRATION BUILDER                  ");
    console.log("==========================================================================\n");

    const configPath = path.join(__dirname, "../scratch/test_db_config.json");
    if (!fs.existsSync(configPath)) {
        throw new Error("Missing scratch/test_db_config.json. Run scratch/provision_and_verify_test_db.js first.");
    }

    const testConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const targetDb = testConfig.database || "rag_healthcare_test";

    // Enforce preflight safety
    verifyDestructiveTestSafety(targetDb);
    console.log(`► [Safety Invariant] Target database verified safe: '${targetDb}'`);

    const pool = mysql.createPool({
        host: testConfig.host || "127.0.0.1",
        port: testConfig.port || 3306,
        user: testConfig.user || "cdss_test_user",
        password: testConfig.password,
        database: targetDb,
        multipleStatements: true,
        waitForConnections: true,
        connectionLimit: 5
    });

    try {
        const [dbCheck] = await pool.query("SELECT DATABASE() AS cur_db");
        if (dbCheck[0].cur_db !== targetDb) {
            throw new Error(`Connected database mismatch! Expected '${targetDb}', got '${dbCheck[0].cur_db}'`);
        }

        console.log(`► [Step 1] Initializing schema_migrations ledger in '${targetDb}'...`);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(100) PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Check already applied migrations
        const [appliedRows] = await pool.query("SELECT version FROM schema_migrations");
        const appliedSet = new Set(appliedRows.map(r => r.version));

        const migrationsDir = path.join(__dirname, "../migrations");

        // 1. Run 000_initial_schema.sql if not applied
        if (!appliedSet.has("000_initial_schema.sql")) {
            console.log("► [Step 2] Applying 000_initial_schema.sql (10 core EHR tables)...");
            const sql000 = fs.readFileSync(path.join(migrationsDir, "000_initial_schema.sql"), "utf8");
            await pool.query(sql000);
            await pool.query("INSERT INTO schema_migrations (version) VALUES (?)", ["000_initial_schema.sql"]);
            console.log("  ✓ Applied 000_initial_schema.sql");
        }

        // 2. Populate synthetic baseline actors (Doctor 1, Patient 1, Patient 2)
        console.log("► [Step 3] Loading synthetic baseline EHR fixtures...");
        const doctorHash = await bcrypt.hash("doctor123", 10);
        const patientHash = await bcrypt.hash("patient123", 10);

        // Ensure Doctor 1 user & profile
        const [docUsers] = await pool.query("SELECT user_id FROM users WHERE email = 'doctor@gmail.com'");
        let doctorUserId;
        if (docUsers.length === 0) {
            const [uRes] = await pool.query(`
                INSERT INTO users (user_id, full_name, email, password, role, phone)
                VALUES (1, 'Dr. Rahul Sharma', 'doctor@gmail.com', ?, 'doctor', '9876500000')
                ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
            `, [doctorHash]);
            doctorUserId = 1;
        } else {
            doctorUserId = docUsers[0].user_id;
            await pool.query("UPDATE users SET password = ? WHERE user_id = ?", [doctorHash, doctorUserId]);
        }

        await pool.query(`
            INSERT INTO doctors (doctor_id, user_id, specialization, qualification, license_number, experience_years, bio)
            VALUES (1, ?, 'Cardiology', 'MD, DM (Cardiology)', 'MCI-2015-8921', 12, 'Senior Cardiologist specializing in preventive cardiology and hypertension.')
            ON DUPLICATE KEY UPDATE specialization = VALUES(specialization);
        `, [doctorUserId]);

        // Ensure Patient 1 user & profile (Aarav Patil - Penicillin allergy)
        const [pat1Users] = await pool.query("SELECT user_id FROM users WHERE email = 'aarav@gmail.com'");
        let pat1UserId;
        if (pat1Users.length === 0) {
            await pool.query(`
                INSERT INTO users (user_id, full_name, email, password, role, phone)
                VALUES (2, 'Aarav Patil', 'aarav@gmail.com', ?, 'patient', '9876501234')
                ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
            `, [patientHash]);
            pat1UserId = 2;
        } else {
            pat1UserId = pat1Users[0].user_id;
            await pool.query("UPDATE users SET password = ? WHERE user_id = ?", [patientHash, pat1UserId]);
        }

        await pool.query(`
            INSERT INTO patients (patient_id, user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
            VALUES (1, ?, '1985-06-15', 'Male', 'O+', 'Flat 402, Shivajinagar, Pune', '9876509999', 'Penicillin')
            ON DUPLICATE KEY UPDATE allergies = VALUES(allergies);
        `, [pat1UserId]);

        // Ensure Patient 2 user & profile (Ananya Deshmukh - Sulfa allergy)
        const [pat2Users] = await pool.query("SELECT user_id FROM users WHERE email = 'ananya@gmail.com'");
        let pat2UserId;
        if (pat2Users.length === 0) {
            await pool.query(`
                INSERT INTO users (user_id, full_name, email, password, role, phone)
                VALUES (3, 'Ananya Deshmukh', 'ananya@gmail.com', ?, 'patient', '9876505678')
                ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
            `, [patientHash]);
            pat2UserId = 3;
        } else {
            pat2UserId = pat2Users[0].user_id;
            await pool.query("UPDATE users SET password = ? WHERE user_id = ?", [patientHash, pat2UserId]);
        }

        await pool.query(`
            INSERT INTO patients (patient_id, user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
            VALUES (2, ?, '1992-11-20', 'Female', 'B+', 'Kothrud, Pune', '9876508888', 'Sulfa')
            ON DUPLICATE KEY UPDATE allergies = VALUES(allergies);
        `, [pat2UserId]);

        // Baseline Appointments
        await pool.query(`
            INSERT IGNORE INTO appointments (appointment_id, doctor_id, patient_id, appointment_date, start_time, end_time, reason, status)
            VALUES
                (1, 1, 1, '2026-09-26', '10:00:00', '10:30:00', 'Regular health consultation', 'cancelled'),
                (2, 1, 1, '2026-09-28', '11:00:00', '11:30:00', 'Follow-up consultation', 'completed'),
                (3, 1, 1, '2026-09-27', '08:00:00', '09:00:00', 'Regular consultation', 'completed'),
                (4, 1, 1, '2026-09-29', '11:00:00', '11:30:00', NULL, 'scheduled'),
                (5, 1, 2, '2026-09-29', '11:00:00', '11:30:00', 'Diabetes follow-up consultation', 'cancelled'),
                (6, 1, 1, '2026-10-02', '14:00:00', '14:30:00', 'checkup', 'completed');
        `);

        // Baseline Doctor Schedule
        await pool.query(`
            INSERT IGNORE INTO doctor_schedule (schedule_id, doctor_id, day_of_week, start_time, end_time, available)
            VALUES
                (1, 1, 'Monday', '08:00:00', '13:00:00', 1),
                (2, 1, 'Tuesday', '09:00:00', '13:00:00', 1),
                (3, 1, 'Wednesday', '17:00:00', '19:00:00', 1),
                (4, 1, 'Thursday', '09:00:00', '13:00:00', 1),
                (5, 1, 'Friday', '14:00:00', '18:00:00', 1),
                (6, 1, 'Saturday', '10:00:00', '13:00:00', 1),
                (7, 1, 'Sunday', '10:00:00', '13:00:00', 1);
        `);

        // Baseline Medical History
        await pool.query(`
            INSERT IGNORE INTO medical_history (history_id, patient_id, condition_name, diagnosis, diagnosed_date, notes)
            VALUES
                (1, 1, 'Essential Hypertension', 'Primary hypertension', '2021-03-15', 'Managed with lifestyle and amlodipine.'),
                (2, 2, 'Type 2 Diabetes Mellitus', 'Early onset T2D', '2020-08-10', 'Under diet and metformin management.');
        `);

        // Baseline Symptoms
        await pool.query(`
            INSERT IGNORE INTO symptoms (symptom_id, patient_id, symptoms, severity, description)
            VALUES
                (1, 1, 'Headache, dizziness, fatigue', 'Moderate', 'Patient reports occasional headache and dizziness.'),
                (2, 2, 'Increased thirst, frequent urination, fatigue', 'Moderate', 'Patient reports increased thirst.');
        `);

        // Baseline Medical Reports
        await pool.query(`
            INSERT IGNORE INTO medical_reports (report_id, patient_id, report_type, report_name, report_date, report_summary, file_path)
            VALUES
                (1, 1, 'Blood Test', 'Complete Blood Count (CBC)', '2026-09-27', 'Normal RBC, WBC, and Platelet levels. Mildly elevated hemoglobin.', 'uploads/reports/aarav_cbc_report.pdf');
        `);

        console.log("  ✓ Synthetic baseline EHR actors & records populated.");

        // 3. Run remaining migrations (001 -> 005)
        const remainingMigrations = [
            "001_add_receptionist_role.sql",
            "002_create_discharges_table.sql",
            "003_create_prescription_ocr_jobs.sql",
            "004_create_account_activations.sql",
            "005_create_prescription_idempotency_keys.sql"
        ];

        console.log("► [Step 4] Applying remaining migrations in sequence...");
        for (const file of remainingMigrations) {
            const [alreadyDone] = await pool.query("SELECT 1 FROM schema_migrations WHERE version = ?", [file]);
            if (alreadyDone.length > 0) {
                console.log(`  [SKIP] ${file} already applied.`);
                continue;
            }
            console.log(`  [APPLYING] ${file}...`);
            const sqlContent = fs.readFileSync(path.join(migrationsDir, file), "utf8");
            await pool.query(sqlContent);
            await pool.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
            console.log(`  ✓ Applied: ${file}`);
        }

        // Ensure synthetic receptionist account exists for test suites
        const recepHash = await bcrypt.hash("receptionist123", 10);
        await pool.query(`
            INSERT INTO users (full_name, email, password, role, phone)
            VALUES ('Pooja Verma', 'receptionist@gmail.com', ?, 'receptionist', '9876500001')
            ON DUPLICATE KEY UPDATE password = VALUES(password);
        `, [recepHash]);
        console.log("  ✓ Synthetic receptionist test credentials provisioned ('receptionist@gmail.com').");

        // Verification of schema
        console.log("\n► [Step 5] Verifying schema and table tally...");
        const [tables] = await pool.query("SHOW TABLES");
        console.log(`  Total tables in '${targetDb}': ${tables.length}`);
        for (const t of tables) {
            const tableName = Object.values(t)[0];
            const [countRes] = await pool.query(`SELECT COUNT(*) AS cnt FROM \`${tableName}\``);
            console.log(`    - ${tableName.padEnd(32)}: ${countRes[0].cnt} rows`);
        }

        const [finalLedger] = await pool.query("SELECT version, applied_at FROM schema_migrations ORDER BY version ASC");
        console.log(`\n  Schema migrations ledger (${finalLedger.length} applied):`);
        for (const m of finalLedger) {
            console.log(`    ✓ ${m.version} (applied: ${m.applied_at})`);
        }

    } finally {
        await pool.end();
    }

    console.log("\n==========================================================================");
    console.log(">>> DISPOSABLE TEST DATABASE SCHEMA & FIXTURES READY 100% <<<");
    console.log("==========================================================================");
}

main().catch(err => {
    console.error("Fixture seeding failed:", err);
    process.exit(1);
});
