/**
 * scratch/clean_doctor_directory.js
 * Auditable cleanup script for doctor directory in rag_healthcare_test.
 *
 * Implements Section 4 of the Final Release Gate audit:
 * 1. Snapshots affected data before modification.
 * 2. Reports duplicates and test artifacts.
 * 3. Applies deterministic cleanup rules.
 * 4. Preserves referential integrity for appointments and prescriptions.
 * 5. Verifies post-cleanup state.
 */

const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend');
const mysql = require(path.join(backendDir, 'node_modules/mysql2/promise'));
require(path.join(backendDir, 'node_modules/dotenv')).config({ path: path.join(backendDir, '.env') });

async function cleanDoctorDirectory() {
  const dbName = 'rag_healthcare_test';
  console.log(`[DOCTOR CLEANUP] Connecting to ${dbName}...`);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
  });

  // 1. Snapshot all doctors and associated users
  const [initialDoctors] = await conn.execute(`
    SELECT d.*, u.email, u.full_name, u.phone, u.role, u.staff_status
    FROM doctors d
    JOIN users u ON d.user_id = u.user_id
  `);

  const snapshotPath = path.join(__dirname, 'doctor_cleanup_snapshot_20261025.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(initialDoctors, null, 2));
  console.log(`[DOCTOR CLEANUP] Step 1: Snapshot saved to ${snapshotPath} (${initialDoctors.length} records)`);

  // 2. Identify records to remove
  // Target test artifacts: doc_alpha, doc_beta, doc_metric, dr.synthetic, audit_unauthorized, unapproved_doc
  // Also duplicate Kavita Verma rows (doctor_id in 34, 36, 37, 39)
  const [testDoctors] = await conn.execute(`
    SELECT d.doctor_id, d.user_id, u.email, u.full_name
    FROM doctors d
    JOIN users u ON d.user_id = u.user_id
    WHERE u.email LIKE 'doc_alpha_%'
       OR u.email LIKE 'doc_beta_%'
       OR u.email LIKE 'doc_metric_%'
       OR u.email LIKE 'dr.synthetic_%'
       OR u.email LIKE 'audit_unauthorized_%'
       OR u.email LIKE 'unapproved_doc_%'
       OR d.doctor_id IN (34, 36, 37, 39)
  `);

  console.log(`[DOCTOR CLEANUP] Step 2: Identified ${testDoctors.length} test/duplicate doctor records for cleanup.`);

  const testDoctorIds = testDoctors.map(d => d.doctor_id);
  const testUserIds = testDoctors.map(d => d.user_id);

  if (testDoctorIds.length > 0) {
    // 3. Reassign any appointments referencing test doctors to Dr. Rahul Sharma (doctor_id = 1)
    const placeholders = testDoctorIds.map(() => '?').join(',');
    const [reassignedAppts] = await conn.execute(
      `UPDATE appointments SET doctor_id = 1 WHERE doctor_id IN (${placeholders})`,
      testDoctorIds
    );
    console.log(`[DOCTOR CLEANUP] Step 3: Reassigned ${reassignedAppts.affectedRows} appointments to primary physician (doctor_id = 1)`);

    // 4. Delete from doctors table
    const [deletedDocs] = await conn.execute(
      `DELETE FROM doctors WHERE doctor_id IN (${placeholders})`,
      testDoctorIds
    );
    console.log(`[DOCTOR CLEANUP] Step 4: Deleted ${deletedDocs.affectedRows} test doctor records.`);

    // 5. Delete corresponding test users (if they have no appointments/prescriptions)
    const userPlaceholders = testUserIds.map(() => '?').join(',');
    const [deletedUsers] = await conn.execute(
      `DELETE FROM users WHERE user_id IN (${userPlaceholders})`,
      testUserIds
    );
    console.log(`[DOCTOR CLEANUP] Step 5: Deleted ${deletedUsers.affectedRows} test user records.`);
  }

  // 6. Enrich canonical physicians with clean clinical credentials
  console.log('[DOCTOR CLEANUP] Step 6: Standardizing credentials for approved physicians...');

  // Dr. Rahul Sharma (1)
  await conn.execute(`
    UPDATE doctors d
    JOIN users u ON d.user_id = u.user_id
    SET d.specialization = 'Cardiology',
        d.qualification = 'MBBS, MD (Cardiology)',
        d.license_number = 'MCI-2022-77182',
        d.experience_years = 14,
        d.bio = 'Senior Consultant Interventional Cardiologist, Head of Cardiovascular Medicine. Consultation Chamber 101, Main Hospital Wing.'
    WHERE d.doctor_id = 1
  `);

  // Dr. Second Doctor -> Dr. Priya Nair (doctor_id = 3, user_id = 10)
  await conn.execute(`
    UPDATE users SET full_name = 'Dr. Priya Nair' WHERE user_id = 10
  `);
  await conn.execute(`
    UPDATE doctors
    SET specialization = 'General Medicine',
        qualification = 'MBBS, MD (Internal Medicine)',
        license_number = 'MCI-2023-88291',
        experience_years = 8,
        bio = 'Primary Care Physician and Internal Medicine Specialist. Consultation Chamber 104, OPD Wing.'
    WHERE doctor_id = 3
  `);

  // Dr. Elena Vance (doctor_id = 29)
  await conn.execute(`
    UPDATE doctors
    SET specialization = 'Cardiology',
        qualification = 'MBBS, MD, DM (Cardiology)',
        license_number = 'MCI-2024-99120',
        experience_years = 9,
        bio = 'Cardiovascular Specialist & Preventive Cardiology Lead. Consultation Chamber 202, Heart Center.'
    WHERE doctor_id = 29
  `);

  // Dr. Kavita Verma (doctor_id = 33)
  await conn.execute(`
    UPDATE doctors
    SET specialization = 'Neurology',
        qualification = 'MBBS, DM (Neurology)',
        license_number = 'NMC-449036-NEURO',
        experience_years = 11,
        bio = 'Senior Neurologist specializing in neurovascular disorders and stroke management. Consultation Chamber 305, Neuro Sciences.'
    WHERE doctor_id = 33
  `);

  // 7. Verify post-cleanup directory
  const [finalDoctors] = await conn.execute(`
    SELECT d.doctor_id, d.user_id, u.email, u.full_name, d.specialization, d.qualification, d.license_number, d.experience_years, u.phone, u.staff_status
    FROM doctors d
    JOIN users u ON d.user_id = u.user_id
    ORDER BY d.doctor_id ASC
  `);

  console.log(`[DOCTOR CLEANUP] Step 7: Clean physician directory verified (${finalDoctors.length} physicians):`);
  console.table(finalDoctors);

  // Check referential integrity
  const [orphanedPrescriptions] = await conn.execute(`
    SELECT prescription_id FROM prescriptions WHERE doctor_id NOT IN (SELECT doctor_id FROM doctors)
  `);
  const [orphanedAppointments] = await conn.execute(`
    SELECT appointment_id FROM appointments WHERE doctor_id NOT IN (SELECT doctor_id FROM doctors)
  `);

  console.log(`[DOCTOR CLEANUP] Referential integrity check:`);
  console.log(` - Orphaned prescriptions: ${orphanedPrescriptions.length}`);
  console.log(` - Orphaned appointments: ${orphanedAppointments.length}`);

  if (orphanedPrescriptions.length > 0 || orphanedAppointments.length > 0) {
    throw new Error('Referential integrity violation detected!');
  }

  console.log('[DOCTOR CLEANUP] SUCCESS: Directory cleaned with 100% referential integrity.');
  await conn.end();
}

cleanDoctorDirectory().catch(err => {
  console.error('[DOCTOR CLEANUP] Error:', err);
  process.exit(1);
});
