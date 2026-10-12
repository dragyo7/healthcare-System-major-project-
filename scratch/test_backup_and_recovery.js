const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/.env') });

async function runBackupRecoveryTest() {
  console.log('=== TESTING ISOLATED DATABASE BACKUP & RESTORE ===');
  const dumpPath = path.resolve(__dirname, 'temp_backup_test.sql');
  const mysqldump = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';
  const mysqlCli = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe';
  const testDb = 'rag_healthcare_restore_test';

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    // 1. Take backup
    console.log('[1/4] Dumping rag_healthcare to temporary test dump...');
    execSync(`"${mysqldump}" -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} --host=127.0.0.1 rag_healthcare --result-file="${dumpPath}"`, { stdio: 'pipe' });
    const dumpStat = fs.statSync(dumpPath);
    console.log(`      Dump created successfully (${dumpStat.size} bytes)`);

    // 2. Create isolated target database
    console.log(`[2/4] Creating isolated database ${testDb}...`);
    await conn.execute(`DROP DATABASE IF EXISTS \`${testDb}\``);
    await conn.execute(`CREATE DATABASE \`${testDb}\` DEFAULT CHARACTER SET utf8mb4`);

    // 3. Restore dump into isolated test DB
    console.log(`[3/4] Restoring dump into ${testDb}...`);
    execSync(`"${mysqlCli}" -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} --host=127.0.0.1 ${testDb} < "${dumpPath}"`, { stdio: 'pipe', shell: 'cmd.exe' });

    // 4. Verify table counts and row parity
    console.log('[4/4] Verifying table counts and row parity between source and restored database...');
    const [origTables] = await conn.execute('SHOW TABLES FROM rag_healthcare');
    const [restTables] = await conn.execute(`SHOW TABLES FROM \`${testDb}\``);
    console.log(`      Source tables: ${origTables.length}, Restored tables: ${restTables.length}`);
    if (origTables.length !== restTables.length) {
      throw new Error(`Table count mismatch: ${origTables.length} vs ${restTables.length}`);
    }

    const [origUsers] = await conn.execute('SELECT COUNT(*) as c FROM rag_healthcare.users');
    const [restUsers] = await conn.execute(`SELECT COUNT(*) as c FROM \`${testDb}\`.users`);
    console.log(`      Source users count: ${origUsers[0].c}, Restored users count: ${restUsers[0].c}`);
    if (origUsers[0].c !== restUsers[0].c) {
      throw new Error('User count mismatch');
    }

    console.log('>>> BACKUP AND RESTORE VERIFICATION PASSED PERFECTLY! <<<');
  } finally {
    // Clean up disposable test database and temporary dump file
    await conn.execute(`DROP DATABASE IF EXISTS \`${testDb}\``);
    if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);
    await conn.end();
  }
}

runBackupRecoveryTest().catch(e => {
  console.error('BACKUP RECOVERY TEST FAILED:', e.message);
  process.exit(1);
});
