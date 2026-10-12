const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/.env') });
const db = require(path.join(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/src/config/db'));
const bcrypt = require('bcrypt');

async function testPass() {
  const [rows] = await db.execute("SELECT email, password FROM users WHERE email = 'aarav@gmail.com'");
  console.log('Row found:', rows.length);
  if (rows.length > 0) {
    const hash = rows[0].password;
    const isBcrypt = hash.startsWith('$2b$10$') && hash.length === 60;
    console.log('Password hash format valid bcrypt ($2b$10$):', isBcrypt);
    if (!isBcrypt) {
      throw new Error('User does not have valid bcrypt hash');
    }
  }
  process.exit(0);
}

testPass().catch(err => {
  console.error(err);
  process.exit(1);
});
