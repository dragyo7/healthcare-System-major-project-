const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/.env') });
const db = require(path.join(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/src/config/db'));

async function check() {
  const [patients] = await db.execute("SELECT p.patient_id, p.user_id, u.email, u.full_name, u.role FROM patients p LEFT JOIN users u ON p.user_id = u.user_id");
  console.log('TOTAL PATIENTS TABLE ROWS:', patients.length);
  for (const p of patients) {
    console.log(`patient_id: ${p.patient_id} | user_id: ${p.user_id} | email: ${p.email} | name: ${p.full_name}`);
  }
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
